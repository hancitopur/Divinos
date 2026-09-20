import { useState } from 'react'
import { supabase, configured } from '../lib/supabase'
import { useT } from '../lib/i18n'
import { Field } from '../components/ui'

export function Login() {
  const { t, lang, setLang } = useT()
  const [mode, setMode] = useState<'in' | 'up'>('in')
  const [email, setEmail] = useState(''); const [password, setPassword] = useState(''); const [name, setName] = useState('')
  const [err, setErr] = useState<string | null>(null); const [msg, setMsg] = useState<string | null>(null); const [busy, setBusy] = useState(false)

  const submit = async (e: React.FormEvent) => {
    e.preventDefault(); setErr(null); setMsg(null); setBusy(true)
    try {
      if (mode === 'in') {
        const { error } = await supabase.auth.signInWithPassword({ email, password }); if (error) throw error
      } else {
        const { data, error } = await supabase.auth.signUp({ email, password, options: { data: { full_name: name } } })
        if (error) throw error
        if (!data.session) setMsg(t('checkEmail'))
      }
    } catch (ex: any) { setErr(ex.message) } finally { setBusy(false) }
  }

  return (
    <div className="auth">
      <form className="card stack" onSubmit={submit}>
        <img className="logo" src="/icon.svg" alt="" />
        <h1 style={{ textAlign: 'center' }}>{t('appName')}</h1>
        {!configured && <div className="error">{t('notConfigured')}</div>}
        {mode === 'up' && <Field label={t('fullName')}><input value={name} onChange={(e) => setName(e.target.value)} required /></Field>}
        <Field label={t('email')}><input type="email" value={email} onChange={(e) => setEmail(e.target.value)} required autoComplete="email" /></Field>
        <Field label={t('password')}><input type="password" value={password} onChange={(e) => setPassword(e.target.value)} required minLength={6} autoComplete={mode === 'in' ? 'current-password' : 'new-password'} /></Field>
        {err && <div className="error">{err}</div>}
        {msg && <div className="info">{msg}</div>}
        <button className="btn" disabled={busy || !configured}>{mode === 'in' ? t('signIn') : t('signUp')}</button>
        <button type="button" className="btn secondary" onClick={() => setMode(mode === 'in' ? 'up' : 'in')}>
          {mode === 'in' ? `${t('noAccount')} ${t('signUp')}` : `${t('haveAccount')} ${t('signIn')}`}
        </button>
        <div className="row" style={{ justifyContent: 'center' }}>
          <select value={lang} onChange={(e) => setLang(e.target.value as any)} style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '4px 8px', background: '#fff' }}>
            <option value="es">Español</option><option value="en">English</option>
          </select>
        </div>
      </form>
    </div>
  )
}
