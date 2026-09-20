import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const TERMS_VERSION = '2026-09-20-v3-draft'
const BILLING_VERSION = '2026-09-20-v2-service-fee'
const PLAN_BASE_CENTS: Record<string, number> = { digital: 900, reserva: 4900, coleccion: 7900 }
const SERVICE_FEE_RATE = 0.075

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)
  try {
    const auth = req.headers.get('Authorization')
    if (!auth) return json({ error: 'Inicia sesión para continuar.' }, 401)
    const url = Deno.env.get('SUPABASE_URL')!
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } })
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) return json({ error: 'Sesión inválida.' }, 401)

    const { plan, acceptLegal, acceptCharges } = await req.json() as { plan?: string; acceptLegal?: boolean; acceptCharges?: boolean }
    if (!['digital','reserva','coleccion'].includes(plan || '')) return json({ error: 'Plan inválido.' }, 400)
    if (acceptLegal !== true || acceptCharges !== true) return json({ error: 'Debes aceptar el acuerdo legal y los cargos antes de pagar.' }, 400)
    const admin = createClient(url, service)
    const { data: onboarding, error: onboardingError } = await admin.from('customer_onboarding').select('*').eq('user_id', user.id).maybeSingle()
    if (onboardingError) throw onboardingError
    const required = ['legal_name','phone','address_line1','city','region','postal_code']
    if (!onboarding || required.some((field) => !String(onboarding[field] || '').trim())) {
      return json({ error: 'Completa tu nombre legal, teléfono y dirección antes de continuar.' }, 400)
    }
    const planKey = `PAYPAL_PLAN_${plan!.toUpperCase()}`
    const planId = Deno.env.get(planKey)
    const clientId = Deno.env.get('PAYPAL_CLIENT_ID')
    const clientSecret = Deno.env.get('PAYPAL_CLIENT_SECRET')
    if (!planId || !clientId || !clientSecret) return json({ error: 'PayPal todavía no está conectado a Divinos.' }, 503)

    const mode = Deno.env.get('PAYPAL_MODE') === 'live' ? 'live' : 'sandbox'
    const api = mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'
    const tokenResponse = await fetch(`${api}/v1/oauth2/token`, {
      method: 'POST', headers: { Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' }, body: 'grant_type=client_credentials',
    })
    if (!tokenResponse.ok) return json({ error: 'PayPal rechazó las credenciales configuradas.' }, 502)
    const { access_token } = await tokenResponse.json()
    const baseCents = PLAN_BASE_CENTS[plan!]
    const feeCents = Math.round(baseCents * SERVICE_FEE_RATE)
    const totalCents = baseCents + feeCents
    const configuredPlanResponse = await fetch(`${api}/v1/billing/plans/${planId}`, { headers: { Authorization: `Bearer ${access_token}` } })
    if (!configuredPlanResponse.ok) return json({ error: 'No se pudo validar el plan configurado en PayPal.' }, 502)
    const configuredPlan = await configuredPlanResponse.json()
    const regularCycle = configuredPlan.billing_cycles?.find((cycle: any) => cycle.tenure_type === 'REGULAR')
    const paypalCents = Math.round(Number(regularCycle?.pricing_scheme?.fixed_price?.value || 0) * 100)
    if (configuredPlan.status !== 'ACTIVE' || paypalCents !== totalCents) {
      return json({ error: `El plan de PayPal debe estar activo y cobrar $${(totalCents / 100).toFixed(2)} al mes, incluyendo el cargo de servicio de 7.5%.` }, 503)
    }

    let { data: account } = await admin.from('client_accounts').select('client_id').eq('user_id', user.id).maybeSingle()
    if (!account) {
      const { data: existing } = await admin.from('clients').select('id').eq('email', user.email).maybeSingle()
      let clientRecord = existing
      if (!clientRecord) {
        const { data: created, error } = await admin.from('clients').insert({ name: onboarding.legal_name, email: user.email, phone: onboarding.phone, active: true }).select('id').single()
        if (error) throw error
        clientRecord = created
      }
      const { error } = await admin.from('client_accounts').insert({ user_id: user.id, client_id: clientRecord!.id })
      if (error) throw error
      account = { client_id: clientRecord!.id }
    }

    const bottleLimit = plan === 'reserva' ? 72 : plan === 'coleccion' ? 144 : null
    const { data: current } = await admin.from('memberships').select('*').eq('user_id', user.id).maybeSingle()
    if (current?.status === 'active') return json({ error: 'Tu membresía ya está activa.' }, 409)

    if (current?.paypal_subscription_id && current.status === 'approval_pending') {
      const check = await fetch(`${api}/v1/billing/subscriptions/${current.paypal_subscription_id}`, { headers: { Authorization: `Bearer ${access_token}` } })
      if (check.ok) {
        const subscription = await check.json()
        const approval = subscription.links?.find((link: any) => link.rel === 'approve')?.href
        if (approval) return json({ approval_url: approval, subscription_id: subscription.id })
      }
    }

    await admin.from('memberships').upsert({ user_id: user.id, client_id: account.client_id, plan, status: 'pending', bottle_limit: bottleLimit, payment_provider: 'paypal', paypal_plan_id: planId }, { onConflict: 'user_id' })
    const site = Deno.env.get('PUBLIC_SITE_URL') || 'https://divinos-iguw.onrender.com'
    const names = onboarding.legal_name.trim().split(/\s+/)
    const subscriptionResponse = await fetch(`${api}/v1/billing/subscriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json', 'PayPal-Request-Id': crypto.randomUUID() },
      body: JSON.stringify({
        plan_id: planId,
        custom_id: user.id,
        subscriber: {
          name: { given_name: names[0], surname: names.slice(1).join(' ') || 'Divinos' },
          email_address: user.email,
          shipping_address: { name: { full_name: onboarding.legal_name }, address: { address_line_1: onboarding.address_line1, address_line_2: onboarding.address_line2 || undefined, admin_area_2: onboarding.city, admin_area_1: onboarding.region, postal_code: onboarding.postal_code, country_code: 'US' } },
        },
        application_context: { brand_name: 'Divinos', locale: 'es-PR', user_action: 'SUBSCRIBE_NOW', return_url: `${site}/#/account?payment=return`, cancel_url: `${site}/#/account?payment=cancelled` },
      }),
    })
    const subscription = await subscriptionResponse.json()
    if (!subscriptionResponse.ok) return json({ error: subscription?.details?.[0]?.description || 'No se pudo crear la suscripción en PayPal.' }, 502)
    const approvalUrl = subscription.links?.find((link: any) => link.rel === 'approve')?.href
    if (!approvalUrl) return json({ error: 'PayPal no devolvió el enlace de aprobación.' }, 502)
    const { error: agreementError } = await admin.from('service_agreements').upsert({
      user_id: user.id, plan, terms_version: TERMS_VERSION, billing_version: BILLING_VERSION,
      base_amount: baseCents / 100, service_fee_rate: 7.5, service_fee_amount: feeCents / 100,
      monthly_amount: totalCents / 100, currency: 'USD', paypal_subscription_id: subscription.id,
    }, { onConflict: 'paypal_subscription_id' })
    if (agreementError) throw agreementError
    await admin.from('memberships').update({ status: 'approval_pending', paypal_subscription_id: subscription.id }).eq('user_id', user.id)
    return json({ approval_url: approvalUrl, subscription_id: subscription.id })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Error inesperado.' }, 500)
  }
})
