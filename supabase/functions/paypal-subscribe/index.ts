import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}

const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })

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

    const { plan } = await req.json() as { plan?: string }
    if (!['digital','reserva','coleccion'].includes(plan || '')) return json({ error: 'Plan inválido.' }, 400)
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

    const admin = createClient(url, service)
    let { data: account } = await admin.from('client_accounts').select('client_id').eq('user_id', user.id).maybeSingle()
    if (!account) {
      const { data: existing } = await admin.from('clients').select('id').eq('email', user.email).maybeSingle()
      let clientRecord = existing
      if (!clientRecord) {
        const { data: profile } = await admin.from('profiles').select('full_name').eq('id', user.id).single()
        const { data: created, error } = await admin.from('clients').insert({ name: profile?.full_name || user.email || 'Cliente Divinos', email: user.email, active: true }).select('id').single()
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
    const names = (user.user_metadata?.full_name || user.email || 'Cliente Divinos').trim().split(/\s+/)
    const subscriptionResponse = await fetch(`${api}/v1/billing/subscriptions`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${access_token}`, 'Content-Type': 'application/json', 'PayPal-Request-Id': crypto.randomUUID() },
      body: JSON.stringify({
        plan_id: planId,
        custom_id: user.id,
        subscriber: { name: { given_name: names[0], surname: names.slice(1).join(' ') || 'Divinos' }, email_address: user.email },
        application_context: { brand_name: 'Divinos', locale: 'es-PR', user_action: 'SUBSCRIBE_NOW', return_url: `${site}/#/account?payment=return`, cancel_url: `${site}/#/account?payment=cancelled` },
      }),
    })
    const subscription = await subscriptionResponse.json()
    if (!subscriptionResponse.ok) return json({ error: subscription?.details?.[0]?.description || 'No se pudo crear la suscripción en PayPal.' }, 502)
    const approvalUrl = subscription.links?.find((link: any) => link.rel === 'approve')?.href
    if (!approvalUrl) return json({ error: 'PayPal no devolvió el enlace de aprobación.' }, 502)
    await admin.from('memberships').update({ status: 'approval_pending', paypal_subscription_id: subscription.id }).eq('user_id', user.id)
    return json({ approval_url: approvalUrl, subscription_id: subscription.id })
  } catch (error) {
    return json({ error: error instanceof Error ? error.message : 'Error inesperado.' }, 500)
  }
})
