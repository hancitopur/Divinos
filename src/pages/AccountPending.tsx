import { useEffect, useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Brand } from '../components/Brand'
import { Field } from '../components/ui'
import { supabase } from '../lib/supabase'
import type { CustomerOnboarding, Membership, MembershipPlan } from '../lib/types'

const plans: Array<{ id: MembershipPlan; name: string; price: number; detail: string }> = [
  { id: 'digital', name: 'Digital', price: 9, detail: 'Inventario digital para tu propia cava' },
  { id: 'reserva', name: 'Reserva', price: 49, detail: 'Aplicación + hasta 72 botellas' },
  { id: 'coleccion', name: 'Colección', price: 79, detail: 'Aplicación + hasta 144 botellas' },
]

const SERVICE_FEE_RATE = 0.075
const money = (cents: number) => `$${(cents / 100).toFixed(2)}`

type Details = Omit<CustomerOnboarding, 'user_id' | 'updated_at'>
const emptyDetails: Details = { legal_name: '', phone: '', address_line1: '', address_line2: '', city: '', region: 'PR', postal_code: '' }

export function AccountPending({ membership }: { membership: Membership | null }) {
  const [params] = useSearchParams()
  const requested = params.get('plan') as MembershipPlan | null
  const [selected, setSelected] = useState<MembershipPlan>(membership?.plan ?? (plans.some((p) => p.id === requested) ? requested! : 'reserva'))
  const [details, setDetails] = useState<Details>(emptyDetails)
  const [acceptedLegal, setAcceptedLegal] = useState(false)
  const [acceptedCharges, setAcceptedCharges] = useState(false)
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null)
  const status = membership?.status
  const plan = plans.find((item) => item.id === selected)!
  const baseCents = plan.price * 100
  const feeCents = Math.round(baseCents * SERVICE_FEE_RATE)
  const totalCents = baseCents + feeCents

  useEffect(() => {
    supabase.auth.getUser().then(async ({ data }) => {
      if (!data.user) return
      const { data: saved } = await supabase.from('customer_onboarding').select('*').eq('user_id', data.user.id).maybeSingle()
      if (saved) setDetails({
        legal_name: saved.legal_name ?? '', phone: saved.phone ?? '', address_line1: saved.address_line1 ?? '',
        address_line2: saved.address_line2 ?? '', city: saved.city ?? '', region: saved.region ?? 'PR', postal_code: saved.postal_code ?? '',
      })
    })
  }, [])

  const update = (key: keyof Details, value: string) => setDetails((current) => ({ ...current, [key]: value }))

  return <div className="pending-shell">
    <header className="pending-head"><Brand light /><button className="btn secondary sm" onClick={() => supabase.auth.signOut()}>Salir</button></header>
    <main className="pending-main">
      <span className="landing-kicker">Tu cuenta Divinos</span>
      <h1>{status === 'approval_pending' ? 'Termina la aprobación en PayPal.' : 'Completa y activa tu membresía.'}</h1>
      <p>Tu información, aceptación y pago son obligatorios. No tendrás acceso al inventario hasta que PayPal confirme la suscripción.</p>
      <Link className="btn secondary" to="/shop">Ver tienda con precio regular</Link>
      <form className="pending-form" onSubmit={async (event) => {
        event.preventDefault(); setBusy(true); setError(null)
        try {
          if (!acceptedLegal || !acceptedCharges) throw new Error('Debes aceptar el acuerdo legal y la divulgación de cargos.')
          const { data: auth } = await supabase.auth.getUser()
          if (!auth.user) throw new Error('Tu sesión expiró. Entra nuevamente.')
          const clean = Object.fromEntries(Object.entries(details).map(([key, value]) => [key, typeof value === 'string' ? value.trim() : value])) as Details
          const { error: saveError } = await supabase.from('customer_onboarding').upsert({ user_id: auth.user.id, ...clean }, { onConflict: 'user_id' })
          if (saveError) throw saveError
          const { data, error: paymentError } = await supabase.functions.invoke('paypal-subscribe', { body: { plan: selected, acceptLegal: true, acceptCharges: true } })
          if (paymentError || !data?.approval_url) throw new Error(data?.error || paymentError?.message || 'PayPal todavía no está configurado.')
          window.location.assign(data.approval_url)
        } catch (ex: any) { setError(ex.message) } finally { setBusy(false) }
      }}>
        <section className="pending-section">
          <div className="pending-step"><b>1</b><span><strong>Información del cliente</strong><small>Necesaria para el acuerdo y la facturación.</small></span></div>
          <div className="pending-fields">
            <Field label="Nombre legal completo"><input value={details.legal_name} onChange={(e)=>update('legal_name', e.target.value)} required autoComplete="name" /></Field>
            <Field label="Teléfono"><input type="tel" value={details.phone} onChange={(e)=>update('phone', e.target.value)} required minLength={7} autoComplete="tel" /></Field>
            <Field label="Dirección física"><input value={details.address_line1} onChange={(e)=>update('address_line1', e.target.value)} required autoComplete="street-address" /></Field>
            <Field label="Apartamento o unidad (opcional)"><input value={details.address_line2 ?? ''} onChange={(e)=>update('address_line2', e.target.value)} /></Field>
            <Field label="Ciudad"><input value={details.city} onChange={(e)=>update('city', e.target.value)} required autoComplete="address-level2" /></Field>
            <div className="pending-address-row">
              <Field label="Estado / territorio"><input value={details.region} onChange={(e)=>update('region', e.target.value.toUpperCase())} required maxLength={3} autoComplete="address-level1" /></Field>
              <Field label="Código postal"><input value={details.postal_code} onChange={(e)=>update('postal_code', e.target.value)} required pattern="[0-9]{5}(-[0-9]{4})?" inputMode="numeric" autoComplete="postal-code" /></Field>
            </div>
          </div>
        </section>

        <section className="pending-section">
          <div className="pending-step"><b>2</b><span><strong>Selecciona tu servicio</strong><small>Las funciones de la cuenta son iguales; cambia la capacidad contratada.</small></span></div>
          <div className="pending-plans">
            {plans.map((item) => <button type="button" className={selected === item.id ? 'selected' : ''} key={item.id} onClick={() => setSelected(item.id)}>
              <span><b>{item.name}</b><small>{item.detail}</small></span><strong>${item.price}<small>/mes</small></strong>
            </button>)}
          </div>
        </section>

        <section className="pending-section pending-consent">
          <div className="pending-step"><b>3</b><span><strong>Acuerdo y cargos</strong><small>Ambas aceptaciones son obligatorias antes de PayPal.</small></span></div>
          <label className="terms-check"><input type="checkbox" checked={acceptedLegal} onChange={(e)=>setAcceptedLegal(e.target.checked)} required /><span>Leí y acepto el <Link to="/terms" target="_blank">acuerdo legal y los términos y condiciones</Link>.</span></label>
          <label className="terms-check"><input type="checkbox" checked={acceptedCharges} onChange={(e)=>setAcceptedCharges(e.target.checked)} required /><span>Autorizo el cargo recurrente total de <strong>{money(totalCents)}/mes</strong> mediante PayPal, compuesto por {money(baseCents)} del plan y {money(feeCents)} de cargo de servicio (7.5%), más impuestos aplicables.</span></label>
          <div className="charge-summary"><span>Plan {plan.name}</span><strong>{money(baseCents)}</strong><span>Cargo de servicio · 7.5%</span><strong>{money(feeCents)}</strong><span className="charge-total">Total mensual</span><strong className="charge-total">{money(totalCents)} USD</strong><small>Renovación automática. Puedes cancelar desde PayPal.</small></div>
        </section>

        {error && <div className="error">{error}</div>}
        <button className="btn pending-pay" disabled={busy || !acceptedLegal || !acceptedCharges}>{busy ? 'Validando y conectando…' : `Aceptar y continuar a PayPal · ${money(totalCents)}/mes`}</button>
      </form>
      <div className="pending-security"><span>🔒 Información privada</span><span>✓ Pago verificado por PayPal</span><span>✓ Acceso solo con cuenta pagada</span></div>
      {params.get('payment') === 'return' && <div className="info">PayPal está confirmando tu suscripción. Actualiza esta página en unos segundos.</div>}
    </main>
  </div>
}
