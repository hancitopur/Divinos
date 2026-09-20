import { useState } from 'react'
import { Link } from 'react-router-dom'
import { Brand } from '../components/Brand'
import { Field } from '../components/ui'
import { supabase } from '../lib/supabase'

export function ResetPassword() {
  const [password, setPassword] = useState('')
  const [confirm, setConfirm] = useState('')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)
  return <div className="auth"><form className="card stack" onSubmit={async (event) => {
    event.preventDefault(); setError(null)
    if (password !== confirm) { setError('Las contraseñas no coinciden.'); return }
    setBusy(true)
    const { error } = await supabase.auth.updateUser({ password })
    setBusy(false)
    if (error) setError(error.message); else setMessage('Contraseña actualizada. Ya puedes entrar a Divinos.')
  }}>
    <Brand className="auth-brand" />
    <h1>Nueva contraseña</h1>
    <Field label="Contraseña"><input type="password" minLength={8} required value={password} onChange={(e) => setPassword(e.target.value)} autoComplete="new-password" /></Field>
    <Field label="Confirmar contraseña"><input type="password" minLength={8} required value={confirm} onChange={(e) => setConfirm(e.target.value)} autoComplete="new-password" /></Field>
    {error && <div className="error">{error}</div>}{message && <div className="info">{message}</div>}
    <button className="btn" disabled={busy}>{busy ? 'Guardando…' : 'Guardar contraseña'}</button>
    <Link className="small muted" style={{ textAlign: 'center' }} to="/login">Volver a entrar</Link>
  </form></div>
}
