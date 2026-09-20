import { useState } from 'react'
import { Link, useSearchParams } from 'react-router-dom'
import { Brand } from '../components/Brand'
import { supabase } from '../lib/supabase'
import type { Membership, MembershipPlan } from '../lib/types'

const plans: Array<{ id: MembershipPlan; name: string; price: number; detail: string }> = [
  { id: 'digital', name: 'Digital', price: 9, detail: 'Inventario digital para tu propia cava' },
  { id: 'reserva', name: 'Reserva', price: 49, detail: 'Aplicación + hasta 72 botellas' },
  { id: 'coleccion', name: 'Colección', price: 79, detail: 'Aplicación + hasta 144 botellas' },
]

export function AccountPending({ membership }: { membership: Membership | null }) {
  const [params] = useSearchParams()
  const requested = params.get('plan') as MembershipPlan | null
  const [selected, setSelected] = useState<MembershipPlan>(membership?.plan ?? (plans.some((p) => p.id === requested) ? requested! : 'reserva'))
  const [busy, setBusy] = useState(false); const [error, setError] = useState<string | null>(null)
  const status = membership?.status
  return <div className="pending-shell">
    <header className="pending-head"><Brand light /><button className="btn secondary sm" onClick={() => supabase.auth.signOut()}>Salir</button></header>
    <main className="pending-main">
      <span className="landing-kicker">Tu cuenta Divinos</span>
      <h1>{status === 'approval_pending' ? 'Termina la aprobación en PayPal.' : 'Activa tu membresía.'}</h1>
      <p>Tu cuenta permanece protegida y sin acceso al inventario hasta que PayPal confirme una suscripción activa.</p>
      <div className="pending-plans">
        {plans.map((plan) => <button type="button" className={selected === plan.id ? 'selected' : ''} key={plan.id} onClick={() => setSelected(plan.id)}>
          <span><b>{plan.name}</b><small>{plan.detail}</small></span><strong>${plan.price}<small>/mes</small></strong>
        </button>)}
      </div>
      <label className="terms-check"><input type="checkbox" checked readOnly /> Acepté los <Link to="/terms">términos del servicio</Link> al crear mi cuenta.</label>
      {error && <div className="error">{error}</div>}
      <button className="btn pending-pay" disabled={busy} onClick={async () => {
        setBusy(true); setError(null)
        const { data, error } = await supabase.functions.invoke('paypal-subscribe', { body: { plan: selected } })
        if (error || !data?.approval_url) setError(data?.error || error?.message || 'PayPal todavía no está configurado.');
        else window.location.assign(data.approval_url)
        setBusy(false)
      }}>{busy ? 'Conectando con PayPal…' : `Continuar con PayPal · $${plans.find((p) => p.id === selected)?.price}/mes`}</button>
      <div className="pending-security"><span>🔒 Cuenta privada</span><span>✓ Cancelación desde PayPal</span><span>✓ Acceso solo con pago activo</span></div>
      {params.get('payment') === 'return' && <div className="info">PayPal está confirmando tu suscripción. Actualiza esta página en unos segundos.</div>}
    </main>
  </div>
}
