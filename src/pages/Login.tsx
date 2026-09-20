import { useEffect, useState } from 'react'
import { Link, useNavigate, useSearchParams } from 'react-router-dom'
import { supabase, configured } from '../lib/supabase'
import { useT } from '../lib/i18n'
import { Field } from '../components/ui'
import { Brand } from '../components/Brand'
import { TERMS_VERSION } from './Terms'
import { wineProductPhoto } from '../lib/productPhotos'
import { storePrices } from '../lib/storePricing'
import { money } from '../lib/i18n'

export function Login() {
  const { t, lang, setLang } = useT()
  const [params] = useSearchParams()
  const navigate = useNavigate()
  const next = params.get('next'); const safeNext = next?.startsWith('/') ? next : '/'
  const productId = safeNext.match(/^\/shop\/([0-9a-f-]+)/i)?.[1] ?? null
  const purchaseMode = safeNext.includes('buy=storage') ? 'storage' : 'pickup'
  const [mode, setMode] = useState<'in' | 'up'>(() => params.get('plan') || next?.startsWith('/shop') ? 'up' : 'in')
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [name, setName] = useState('')
  const [err, setErr] = useState<string | null>(null); const [msg, setMsg] = useState<string | null>(null); const [busy, setBusy] = useState(false)
  const [accepted, setAccepted] = useState(false)
  const [checkoutOffer, setCheckoutOffer] = useState<any|null>(null)

  useEffect(() => {
    if (!productId) return
    supabase.from('wine_sale_offers').select('id,price,active,wines(name,producer,vintage,region,country)').eq('id', productId).eq('active', true).maybeSingle().then(({ data }) => setCheckoutOffer(data))
  }, [productId])

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null); setMsg(null); setBusy(true)
    try {
      if (mode === 'in') {
        const { error } = await supabase.auth.signInWithPassword({ email, password }); if (error) throw error
        navigate(safeNext)
      } else {
        if (!accepted) throw new Error('Debes aceptar los términos para crear la cuenta.')
        const plan = params.get('plan')
        const { data, error } = await supabase.auth.signUp({ email, password, options: {
          data: { full_name: name, terms_accepted: true, terms_version: TERMS_VERSION },
          emailRedirectTo: `${window.location.origin}/#/login?${new URLSearchParams({...plan?{plan}:{},...safeNext!=='/'?{next:safeNext}:{}}).toString()}`,
        } })
        if (error) throw error
        if (data.session) navigate(safeNext); else setMsg(`${t('checkEmail')} Luego regresarás al producto seleccionado.`)
      }
    } catch (ex: any) { setErr(ex.message) } finally { setBusy(false) }
  }

  return (
    <div className="auth">
      <form className={`card stack ${checkoutOffer ? 'checkout-auth-card' : ''}`} onSubmit={submit}>
        <Brand className="auth-brand" />
        {checkoutOffer && (()=>{const wine=Array.isArray(checkoutOffer.wines)?checkoutOffer.wines[0]:checkoutOffer.wines;const price=storePrices(Number(checkoutOffer.price)).public;return <div className="checkout-auth-summary"><img src={wineProductPhoto(wine?.name)} alt={`Botella de ${wine?.name||'vino'}`}/><div><small>Tu selección</small><b>{wine?.name} {wine?.vintage||''}</b><span>{[wine?.producer,wine?.region].filter(Boolean).join(' · ')}</span><strong>{money(price,lang)}</strong><em>{purchaseMode==='storage'?'Guardar en Divinos requiere una membresía física activa.':'Compra para recogido autorizado.'}</em></div></div>})()}
        {next?.startsWith('/shop') && <div className="checkout-progress" aria-label="Progreso de compra"><span className="active"><b>1</b> Cuenta</span><i/><span><b>2</b> Confirmar</span><i/><span><b>3</b> PayPal</span></div>}
        {next?.startsWith('/shop') && <div className="info"><b>Continúa donde estabas</b><br/>Al entrar regresarás a esta botella para confirmar edad y pago.</div>}
        {!configured && <div className="error">{t('notConfigured')}</div>}
        {mode === 'up' && <Field label={t('fullName')}><input value={name} onChange={(e) => setName(e.target.value)} required /></Field>}
        <Field label={t('email')}><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></Field>
        <Field label={t('password')}><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={8} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} /></Field>
        {mode === 'up' && <label className="terms-check"><input type="checkbox" checked={accepted} onChange={(e)=>setAccepted(e.target.checked)} required /><span>Leí y acepto el <Link to="/terms" target="_blank">acuerdo legal y los términos y condiciones</Link>. Antes del pago confirmaré el producto, entrega y precio final.</span></label>}
        {err && <div className="error">{err}</div>}
        {msg && <div className="info">{msg}</div>}
        <button className="btn" disabled={busy || !configured || (mode === 'up' && !accepted)}>{mode === 'in' ? t('signIn') : t('signUp')}</button>
        <button type="button" className="btn secondary" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
          {mode === 'in' ? `${t('noAccount')} ${t('signUp')}` : `${t('haveAccount')} ${t('signIn')}`}
        </button>
        {mode === 'in' && <button type="button" className="text-button" onClick={async()=>{
          if (!email) { setErr('Escribe tu correo primero.'); return }
          setBusy(true); setErr(null)
          const { error } = await supabase.auth.resetPasswordForEmail(email, { redirectTo: `${window.location.origin}/#/reset-password` })
          setBusy(false); if(error)setErr(error.message);else setMsg('Te enviamos un enlace para cambiar tu contraseña.')
        }}>Olvidé mi contraseña</button>}
        <div className="auth-divider"><span>o</span></div>
        <Link className="btn demo-entry" to="/demo">Ver cómo funciona el servicio</Link>
        <Link className="small muted" style={{ textAlign: 'center' }} to="/">Volver a divinospr.com</Link>
        <div className="row" style={{ justifyContent: 'center' }}>
          <select value={lang} onChange={(e) => setLang(e.target.value as any)} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '4px 8px', background: '#fff' }}>
            <option value="es">Español</option><option value="en">English</option>
          </select>
        </div>
      </form>
    </div>
  )
}
