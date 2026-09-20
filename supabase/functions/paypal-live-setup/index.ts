import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const cors = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
}
const json = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { ...cors, 'Content-Type': 'application/json' } })
const prices = { digital: '24.99', reserva: '120.00', coleccion: '175.00' } as const

async function paypalJson(api: string, token: string, path: string, init: RequestInit = {}) {
  const response = await fetch(`${api}${path}`, {
    ...init,
    headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json', ...(init.headers || {}) },
  })
  const data = await response.json().catch(() => ({}))
  if (!response.ok) {
    const detail = data?.details?.[0]?.description || data?.message || `PayPal respondió ${response.status}`
    throw new Error(detail)
  }
  return data
}

Deno.serve(async (req) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: cors })
  if (req.method !== 'POST') return json({ error: 'Método no permitido' }, 405)
  try {
    const auth = req.headers.get('Authorization')
    if (!auth) return json({ error: 'Inicia sesión.' }, 401)
    const url = Deno.env.get('SUPABASE_URL')!
    const anon = Deno.env.get('SUPABASE_ANON_KEY')!
    const service = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
    const userClient = createClient(url, anon, { global: { headers: { Authorization: auth } } })
    const { data: { user }, error: userError } = await userClient.auth.getUser()
    if (userError || !user) return json({ error: 'Sesión inválida.' }, 401)

    const admin = createClient(url, service)
    const { data: profile } = await admin.from('profiles').select('role').eq('id', user.id).maybeSingle()
    if (profile?.role !== 'superadmin') return json({ error: 'Solo el superadmin puede configurar PayPal.' }, 403)

    const body = await req.json().catch(() => ({})) as { action?: 'status' | 'setup' }
    const { data: existing } = await admin.from('paypal_config').select('*').eq('id', 1).maybeSingle()
    const configured = Boolean(existing?.product_id && existing?.plan_digital && existing?.plan_reserva && existing?.plan_coleccion && existing?.webhook_id)
    if (body.action === 'status') return json({ ready: configured, mode: existing?.mode || Deno.env.get('PAYPAL_MODE') || 'sandbox', updated_at: existing?.updated_at || null })
    if (body.action !== 'setup') return json({ error: 'Acción inválida.' }, 400)

    const clientId = Deno.env.get('PAYPAL_CLIENT_ID')
    const clientSecret = Deno.env.get('PAYPAL_CLIENT_SECRET')
    const mode = Deno.env.get('PAYPAL_MODE')
    if (!clientId || !clientSecret) return json({ error: 'Faltan las credenciales de PayPal.' }, 503)
    if (mode !== 'live') return json({ error: 'PAYPAL_MODE debe ser live.' }, 503)
    if (configured) return json({ ready: true, mode: 'live', prices, message: 'PayPal Live ya estaba configurado.' })

    const api = 'https://api-m.paypal.com'
    const tokenResponse = await fetch(`${api}/v1/oauth2/token`, {
      method: 'POST',
      headers: { Authorization: `Basic ${btoa(`${clientId}:${clientSecret}`)}`, 'Content-Type': 'application/x-www-form-urlencoded' },
      body: 'grant_type=client_credentials',
    })
    if (!tokenResponse.ok) return json({ error: 'PayPal rechazó el Client ID o el Secret Live.' }, 502)
    const { access_token } = await tokenResponse.json()

    let config: Record<string, unknown> = existing || { id: 1, mode: 'live' }
    await admin.from('paypal_config').upsert({ id: 1, mode: 'live', setup_status: 'configuring', setup_error: null })

    if (!config.product_id) {
      const product = await paypalJson(api, access_token, '/v1/catalogs/products', {
        method: 'POST',
        headers: { 'PayPal-Request-Id': 'divinos-membership-product-v1' },
        body: JSON.stringify({ name: 'Divinos Membership', description: 'Inventario digital y almacenamiento privado de vinos.', type: 'SERVICE' }),
      })
      config = { ...config, product_id: product.id }
      await admin.from('paypal_config').update({ product_id: product.id }).eq('id', 1)
    }

    for (const [key, amount] of Object.entries(prices) as Array<[keyof typeof prices, string]>) {
      const column = `plan_${key}`
      if (config[column]) continue
      const plan = await paypalJson(api, access_token, '/v1/billing/plans', {
        method: 'POST',
        headers: { 'PayPal-Request-Id': `divinos-${key}-plan-v1` },
        body: JSON.stringify({
          product_id: config.product_id,
          name: `Divinos ${key[0].toUpperCase()}${key.slice(1)}`,
          description: `Membresía mensual ${key} de Divinos. Precio final con servicio incluido.`,
          status: 'ACTIVE',
          billing_cycles: [{ frequency: { interval_unit: 'MONTH', interval_count: 1 }, tenure_type: 'REGULAR', sequence: 1, total_cycles: 0, pricing_scheme: { fixed_price: { value: amount, currency_code: 'USD' } } }],
          payment_preferences: { auto_bill_outstanding: true, setup_fee_failure_action: 'CONTINUE', payment_failure_threshold: 3 },
        }),
      })
      config = { ...config, [column]: plan.id }
      await admin.from('paypal_config').update({ [column]: plan.id }).eq('id', 1)
    }

    if (!config.webhook_id) {
      const webhook = await paypalJson(api, access_token, '/v1/notifications/webhooks', {
        method: 'POST',
        headers: { 'PayPal-Request-Id': 'divinos-live-webhook-v1' },
        body: JSON.stringify({
          url: `${url}/functions/v1/paypal-webhook`,
          event_types: [
            'BILLING.SUBSCRIPTION.ACTIVATED', 'BILLING.SUBSCRIPTION.SUSPENDED', 'BILLING.SUBSCRIPTION.CANCELLED',
            'BILLING.SUBSCRIPTION.EXPIRED', 'BILLING.SUBSCRIPTION.PAYMENT.FAILED', 'PAYMENT.SALE.COMPLETED',
          ].map((name) => ({ name })),
        }),
      })
      config = { ...config, webhook_id: webhook.id }
      await admin.from('paypal_config').update({ webhook_id: webhook.id }).eq('id', 1)
    }

    await admin.from('paypal_config').update({ setup_status: 'ready', setup_error: null, updated_at: new Date().toISOString() }).eq('id', 1)
    return json({ ready: true, mode: 'live', prices, message: 'PayPal Live quedó conectado.' })
  } catch (error) {
    const message = error instanceof Error ? error.message : 'Error inesperado'
    try {
      const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
      await admin.from('paypal_config').upsert({ id: 1, mode: 'live', setup_status: 'error', setup_error: message, updated_at: new Date().toISOString() })
    } catch { /* Keep the original PayPal error. */ }
    return json({ error: message }, 500)
  }
})
