import 'jsr:@supabase/functions-js/edge-runtime.d.ts'
import { createClient } from 'jsr:@supabase/supabase-js@2'

const reply = (body: unknown, status = 200) => new Response(JSON.stringify(body), { status, headers: { 'Content-Type': 'application/json' } })

Deno.serve(async (req) => {
  if (req.method !== 'POST') return reply({ error: 'Método no permitido' }, 405)
  const raw = await req.text()
  let event: any
  try { event = JSON.parse(raw) } catch { return reply({ error: 'JSON inválido' }, 400) }
  try {
    const clientId = Deno.env.get('PAYPAL_CLIENT_ID')
    const clientSecret = Deno.env.get('PAYPAL_CLIENT_SECRET')
    const webhookId = Deno.env.get('PAYPAL_WEBHOOK_ID')
    if (!clientId || !clientSecret || !webhookId) return reply({ error: 'Webhook no configurado' }, 503)
    const mode = Deno.env.get('PAYPAL_MODE') === 'live' ? 'live' : 'sandbox'
    const api = mode === 'live' ? 'https://api-m.paypal.com' : 'https://api-m.sandbox.paypal.com'
    const tokenResponse = await fetch(`${api}/v1/oauth2/token`, { method:'POST', headers:{ Authorization:`Basic ${btoa(`${clientId}:${clientSecret}`)}`, 'Content-Type':'application/x-www-form-urlencoded' }, body:'grant_type=client_credentials' })
    if (!tokenResponse.ok) return reply({ error: 'No se pudo validar con PayPal' }, 502)
    const { access_token } = await tokenResponse.json()
    const verification = await fetch(`${api}/v1/notifications/verify-webhook-signature`, {
      method:'POST', headers:{ Authorization:`Bearer ${access_token}`, 'Content-Type':'application/json' },
      body:JSON.stringify({ transmission_id:req.headers.get('paypal-transmission-id'), transmission_time:req.headers.get('paypal-transmission-time'), cert_url:req.headers.get('paypal-cert-url'), auth_algo:req.headers.get('paypal-auth-algo'), transmission_sig:req.headers.get('paypal-transmission-sig'), webhook_id:webhookId, webhook_event:event }),
    })
    const verified = await verification.json()
    if (!verification.ok || verified.verification_status !== 'SUCCESS') return reply({ error: 'Firma inválida' }, 401)

    const admin = createClient(Deno.env.get('SUPABASE_URL')!, Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!)
    const { data: seen } = await admin.from('payment_events').select('id').eq('id', event.id).maybeSingle()
    if (seen) return reply({ received: true, duplicate: true })
    await admin.from('payment_events').insert({ id:event.id, event_type:event.event_type, resource_id:event.resource?.id })

    const subscriptionId = event.resource?.id || event.resource?.billing_agreement_id
    const userId = event.resource?.custom_id
    let status: string | null = null
    if (['BILLING.SUBSCRIPTION.ACTIVATED','PAYMENT.SALE.COMPLETED'].includes(event.event_type)) status = 'active'
    if (event.event_type === 'BILLING.SUBSCRIPTION.SUSPENDED') status = 'suspended'
    if (event.event_type === 'BILLING.SUBSCRIPTION.CANCELLED') status = 'cancelled'
    if (event.event_type === 'BILLING.SUBSCRIPTION.EXPIRED') status = 'expired'
    if (event.event_type === 'BILLING.SUBSCRIPTION.PAYMENT.FAILED') status = 'past_due'

    if (status && subscriptionId) {
      const changes: Record<string, unknown> = { status, paypal_payer_id:event.resource?.subscriber?.payer_id || null, current_period_end:event.resource?.billing_info?.next_billing_time || null }
      if (status === 'active') changes.activated_at = new Date().toISOString()
      const query = admin.from('memberships').update(changes)
      const { data: membership, error } = userId ? await query.eq('user_id', userId).select('user_id').maybeSingle() : await query.eq('paypal_subscription_id', subscriptionId).select('user_id').maybeSingle()
      if (error) throw error
      if (membership?.user_id) await admin.from('profiles').update({ role: status === 'active' ? 'member' : 'pending' }).eq('id', membership.user_id).neq('role','superadmin').neq('role','admin')
    }
    await admin.from('payment_events').update({ status:status?'processed':'ignored', processed_at:new Date().toISOString() }).eq('id',event.id)
    return reply({ received: true })
  } catch (error) {
    return reply({ error:error instanceof Error?error.message:'Error inesperado' },500)
  }
})
