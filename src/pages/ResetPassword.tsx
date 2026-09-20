import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'

export function ResetPassword() {
  const [password,setPassword]=useState(''); const [confirm,setConfirm]=useState('')
  const [ready,setReady]=useState(false); const [busy,setBusy]=useState(false); const [error,setError]=useState<string|null>(null); const [done,setDone]=useState(false)
  useEffect(()=>{
    supabase.auth.getSession().then(({data})=>setReady(Boolean(data.session)))
    const {data}=supabase.auth.onAuthStateChange((event,session)=>{if(event==='PASSWORD_RECOVERY'||session)setReady(true)})
    return()=>data.subscription.unsubscribe()
  },[])
  const save=async(e:React.FormEvent)=>{e.preventDefault();setError(null)
    if(password.length<8)return setError('La contraseña debe tener al menos 8 caracteres.')
    if(password!==confirm)return setError('Las contraseñas no coinciden.')
    setBusy(true);const {error}=await supabase.auth.updateUser({password});setBusy(false)
    if(error)setError(error.message);else{setDone(true);await supabase.auth.signOut()}
  }
  return <div className="auth"><div className="card stack reset-card"><img className="logo" src="/icon.svg" alt="CigarrosPR"/><h1>Nueva contraseña</h1>
    {done?<><div className="success-panel"><b>Contraseña actualizada</b><span>Ya puedes entrar con tu nueva contraseña.</span></div><a className="btn" href="/">Iniciar sesión</a></>:!ready?<><div className="error">Este enlace venció o ya fue utilizado.</div><a className="btn secondary" href="/">Solicitar otro enlace</a></>:<form className="stack" onSubmit={save}><p className="muted small">Crea una contraseña de 8 caracteres o más.</p><label className="field"><span>Contraseña nueva</span><input type="password" required minLength={8} autoComplete="new-password" value={password} onChange={e=>setPassword(e.target.value)}/></label><label className="field"><span>Confirmar contraseña</span><input type="password" required minLength={8} autoComplete="new-password" value={confirm} onChange={e=>setConfirm(e.target.value)}/></label>{error&&<div className="error">{error}</div>}<button className="btn" disabled={busy}>{busy?'Guardando…':'Guardar contraseña'}</button></form>}
  </div></div>
}
