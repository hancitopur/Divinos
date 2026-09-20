import { useEffect, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useAuth } from '../lib/auth'
import { Empty, Loading } from '../components/ui'

type StaffRow = { id:string; full_name:string|null; role:'admin'|'staff'; email:string|null; created_at:string }
export function Admin() {
  const { profile } = useAuth(); const [staff,setStaff]=useState<StaffRow[]|null>(null); const [err,setErr]=useState<string|null>(null)
  const load=()=>supabase.rpc('list_staff').then(({data,error})=>{setStaff((data??[]) as StaffRow[]);setErr(error?.message??null)})
  useEffect(()=>{if(profile?.role==='admin')load()},[profile?.role])
  if(profile?.role!=='admin') return <div className="error">Esta sección requiere acceso de administrador.</div>
  const change=async(id:string,role:'admin'|'staff')=>{const {error}=await supabase.from('profiles').update({role}).eq('id',id);if(error)setErr(error.message);else load()}
  return <div className="stack"><div><h1>Administración</h1><p className="muted">Usuarios, permisos y operación del portal.</p></div>
    <div className="grid4"><div className="stat"><div className="label">Personal</div><div className="value">{staff?.length??'—'}</div></div><div className="stat"><div className="label">Administradores</div><div className="value">{staff?.filter(x=>x.role==='admin').length??'—'}</div></div></div>
    <div className="card stack"><h2>Accesos</h2>{err&&<div className="error">{err}</div>}{staff===null?<Loading/>:staff.length===0?<Empty/>:<div className="table-wrap"><table className="table"><thead><tr><th>Usuario</th><th>Correo</th><th>Rol</th></tr></thead><tbody>{staff.map(u=><tr key={u.id}><td>{u.full_name||'Sin nombre'}</td><td>{u.email}</td><td><select value={u.role} disabled={u.id===profile.id} onChange={e=>change(u.id,e.target.value as 'admin'|'staff')}><option value="staff">Personal</option><option value="admin">Administrador</option></select></td></tr>)}</tbody></table></div>}</div>
    <div className="card stack"><h2>Configuración del negocio</h2><p className="muted small">CigarrosPR · Moneda USD · IVU 11.5% · Inventario por unidad o caja · Ubicación por humidor, gaveta y espacio.</p></div>
  </div>
}
