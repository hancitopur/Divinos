import { useEffect, useMemo, useState } from 'react'
import { Link } from 'react-router-dom'
import { Empty, Field, Loading, PhotoPicker, Thumb } from '../components/ui'
import { useAuth } from '../lib/auth'
import { money, useT } from '../lib/i18n'
import { supabase } from '../lib/supabase'
import type { BottleDetail, IntakeRequest, Membership, StorageSummary, WineType } from '../lib/types'
import { importWineImage, searchWineImages, type WineImageResult } from '../lib/wineImages'

const planName = (plan?: string) => ({ digital: 'Digital', reserva: 'Reserva', coleccion: 'Colección' }[plan || ''] || 'Divinos')

export function ClientOverview() {
  const { membership } = useAuth(); const { lang } = useT()
  const [summary, setSummary] = useState<StorageSummary | null>(null)
  const [recent, setRecent] = useState<BottleDetail[]>([])
  useEffect(() => {
    supabase.from('storage_summary').select('*').single().then(({ data }) => setSummary(data as StorageSummary))
    supabase.from('bottle_details').select('*').order('updated_at', { ascending: false }).limit(4).then(({ data }) => setRecent((data ?? []) as BottleDetail[]))
  }, [])
  if (!summary) return <Loading />
  const limit = membership?.bottle_limit; const pct = limit ? Math.min(100, Math.round((summary.bottles_in_storage / limit) * 100)) : 0
  return <div className="stack client-page">
    <div className="client-welcome"><span className="landing-kicker">Mi colección</span><h1>{planName(membership?.plan)}</h1><p>Todo lo que tienes en Divinos, siempre localizado.</p></div>
    <div className="client-stats">
      <div><small>Botellas</small><strong>{summary.bottles_in_storage}</strong>{limit && <span>de {limit}</span>}</div>
      <div><small>Valor registrado</small><strong>{money(summary.purchase_value, lang)}</strong><span>compra</span></div>
    </div>
    {limit && <div className="client-capacity"><div className="row between"><b>Capacidad del plan</b><span>{pct}%</span></div><i><em style={{ width: `${pct}%` }} /></i></div>}
    <div className="row between"><h2>Actividad reciente</h2><Link className="small bold" to="/collection">Ver todas</Link></div>
    {recent.length === 0 ? <Empty /> : <div className="client-bottle-strip">{recent.map((b) => <article key={b.id}><Thumb path={b.label_photo_path} label={`${b.wine_name} ${b.vintage ?? ''}`} /><div><b>{b.wine_name}</b><small>{[b.vintage,b.region].filter(Boolean).join(' · ')}</small><span>{b.rack_name ? `${b.rack_name} · S${b.shelf} · P${b.position}` : 'Por ubicar'}</span></div></article>)}</div>}
    <Link className="btn client-primary" to="/intake">+ Añadir botellas</Link>
  </div>
}

export function ClientCollection() {
  const { lang } = useT(); const [rows, setRows] = useState<BottleDetail[] | null>(null); const [q, setQ] = useState('')
  useEffect(() => { supabase.from('bottle_details').select('*').order('updated_at', { ascending: false }).then(({ data }) => setRows((data ?? []) as BottleDetail[])) }, [])
  const list = useMemo(() => (rows ?? []).filter((b) => [b.wine_name,b.producer,b.region,b.country,String(b.vintage ?? '')].join(' ').toLowerCase().includes(q.toLowerCase())), [rows,q])
  return <div className="stack client-page"><div><span className="landing-kicker">Inventario privado</span><h1>Mi colección</h1></div><input className="search" placeholder="Buscar por vino, región o añada…" value={q} onChange={(e) => setQ(e.target.value)} />
    {rows === null ? <Loading /> : list.length === 0 ? <Empty /> : <div className="client-collection-grid">{list.map((b) => <article key={b.id}><Thumb path={b.label_photo_path} label={`${b.wine_name} ${b.vintage ?? ''}`} /><div><small>{[b.region,b.country].filter(Boolean).join(' · ')}</small><h3>{b.wine_name} {b.vintage || ''}</h3><p>{b.producer}</p><div className="row between"><b>{money(b.purchase_price,lang)}</b><span className="loc">{b.rack_name ? `${b.rack_name} · S${b.shelf} · P${b.position}` : 'Por ubicar'}</span></div></div></article>)}</div>}
  </div>
}

export function ClientIntake() {
  const { clientId } = useAuth()
  const [form, setForm] = useState({ name:'', producer:'', vintage:'', region:'', country:'', varietal:'', type:'red' as WineType, size_ml:'750', quantity:'1', purchase_price:'', notes:'', label_photo_path:'' })
  const [query,setQuery]=useState(''); const [results,setResults]=useState<WineImageResult[]>([]); const [busy,setBusy]=useState(false); const [error,setError]=useState<string|null>(null); const [done,setDone]=useState(false)
  const set=(key:string,value:string)=>setForm((prev)=>({...prev,[key]:value}))
  const searchLabels = async () => {
    setBusy(true); setError(null)
    try { setResults(await searchWineImages(query)) } catch (ex: any) { setError(ex.message) } finally { setBusy(false) }
  }
  const chooseResult = async (result: WineImageResult) => {
    setBusy(true); setError(null)
    try {
      const path = await importWineImage(result, `clients/${clientId}/intake`)
      setForm((prev)=>({ ...prev, name:result.name||result.title, producer:result.producer||prev.producer,
        vintage:result.vintage?String(result.vintage):prev.vintage, region:result.region||prev.region,
        country:result.country||prev.country, varietal:result.varietal||prev.varietal, type:result.type||prev.type,
        size_ml:result.sizeMl?String(result.sizeMl):prev.size_ml, label_photo_path:path }))
      setResults([])
    } catch (ex: any) { setError(ex.message) } finally { setBusy(false) }
  }
  if (!clientId) return <div className="error">Tu cuenta todavía no está vinculada a una colección.</div>
  return <div className="stack client-page"><div><span className="landing-kicker">Entrada digital</span><h1>Añadir botellas</h1><p className="muted">Busca la etiqueta o toma una foto. Divinos verificará los datos cuando reciba tu colección.</p></div>
    {done ? <div className="client-success"><span>✓</span><h2>Colección enviada</h2><p>La entrada quedó pendiente de revisión. Te avisaremos cuando las botellas estén verificadas y ubicadas.</p><button className="btn" onClick={()=>{setDone(false);setForm({...form,name:'',producer:'',vintage:'',quantity:'1',purchase_price:'',notes:'',label_photo_path:''})}}>Añadir otra</button></div> : <form className="stack intake-live" onSubmit={async(e)=>{
      e.preventDefault();setBusy(true);setError(null)
      const { data:req,error:reqErr }=await supabase.from('intake_requests').insert({client_id:clientId,submitted_by:(await supabase.auth.getUser()).data.user!.id,status:'draft'}).select('id').single()
      if(reqErr){setError(reqErr.message);setBusy(false);return}
      const {error:itemErr}=await supabase.from('intake_items').insert({request_id:req.id,client_id:clientId,name:form.name,producer:form.producer||null,vintage:form.vintage?Number(form.vintage):null,region:form.region||null,country:form.country||null,varietal:form.varietal||null,wine_type:form.type,size_ml:Number(form.size_ml||750),quantity:Number(form.quantity||1),purchase_price:form.purchase_price?Number(form.purchase_price):null,label_photo_path:form.label_photo_path||null,notes:form.notes||null})
      if(itemErr){setError(itemErr.message);setBusy(false);return}
      const {error:submitErr}=await supabase.from('intake_requests').update({status:'submitted',submitted_at:new Date().toISOString()}).eq('id',req.id)
      setBusy(false);if(submitErr)setError(submitErr.message);else setDone(true)
    }}>
      <div className="label-search card stack"><strong>Buscar etiqueta por nombre</strong><div className="row"><input className="search" placeholder="Marca, vino y añada" value={query} onChange={(e)=>setQuery(e.target.value)} /><button type="button" className="btn" disabled={busy||query.trim().length<3} onClick={searchLabels}>Buscar</button></div>
        {results.length>0&&<div className="label-results">{results.map((result)=><button type="button" className="label-result" key={result.id} onClick={()=>chooseResult(result)}><img src={result.thumbnailUrl} alt="" /><span><b>{result.title}</b><small>{result.subtitle}</small></span></button>)}</div>}
      </div>
      <Field label="Foto de la etiqueta"><PhotoPicker path={form.label_photo_path} prefix={`clients/${clientId}/intake`} onUploaded={(path)=>set('label_photo_path',path)} /></Field>
      <Field label="Vino"><input required value={form.name} onChange={(e)=>set('name',e.target.value)} /></Field>
      <div className="grid2"><Field label="Productor"><input value={form.producer} onChange={(e)=>set('producer',e.target.value)} /></Field><Field label="Añada"><input type="number" min="1800" max="2100" value={form.vintage} onChange={(e)=>set('vintage',e.target.value)} /></Field><Field label="Región"><input value={form.region} onChange={(e)=>set('region',e.target.value)} /></Field><Field label="País"><input value={form.country} onChange={(e)=>set('country',e.target.value)} /></Field><Field label="Cantidad"><input type="number" min="1" max="200" required value={form.quantity} onChange={(e)=>set('quantity',e.target.value)} /></Field><Field label="Precio por botella (opcional)"><input type="number" min="0" step="0.01" value={form.purchase_price} onChange={(e)=>set('purchase_price',e.target.value)} /></Field></div>
      <Field label="Notas"><textarea rows={2} value={form.notes} onChange={(e)=>set('notes',e.target.value)} /></Field>
      {error&&<div className="error">{error}</div>}<button className="btn" disabled={busy}>{busy?'Enviando…':`Enviar ${form.quantity} botella${Number(form.quantity)===1?'':'s'} a revisión`}</button>
    </form>}
  </div>
}

export function ClientAccount() {
  const { session, profile, membership }=useAuth(); const [requests,setRequests]=useState<IntakeRequest[]>([])
  useEffect(()=>{supabase.from('intake_requests').select('*').order('created_at',{ascending:false}).then(({data})=>setRequests((data??[]) as IntakeRequest[]))},[])
  return <div className="stack client-page"><div><span className="landing-kicker">Cuenta</span><h1>{profile?.full_name||'Mi cuenta'}</h1><p className="muted">{session?.user.email}</p></div><div className="account-plan"><span><small>Plan activo</small><b>{planName(membership?.plan)}</b></span><strong>{membership?.bottle_limit?`${membership.bottle_limit} botellas`:'Cava propia'}</strong></div>
    <div className="card stack"><h2>Entradas enviadas</h2>{requests.length===0?<p className="muted small">Aún no has enviado botellas.</p>:requests.map((r)=><div className="row between" key={r.id}><span>{new Date(r.created_at).toLocaleDateString('es-PR')}</span><span className="badge">{r.status}</span></div>)}</div>
    <Link className="btn secondary" to="/terms">Términos del servicio</Link><button className="btn danger" onClick={()=>supabase.auth.signOut()}>Cerrar sesión</button>
  </div>
}

export function AdminIntakes() {
  const [requests,setRequests]=useState<any[]|null>(null)
  const load=()=>supabase.from('intake_requests').select('*, clients(name), intake_items(*)').order('created_at',{ascending:false}).then(({data})=>setRequests(data??[]))
  useEffect(()=>{load()},[])
  return <div className="stack"><div><span className="landing-kicker">Recepción</span><h1>Entradas de clientes</h1></div>{requests===null?<Loading/>:requests.length===0?<Empty/>:<div className="list">{requests.map((r)=><div className="card stack" key={r.id}><div className="row between"><div><b>{r.clients?.name}</b><div className="muted small">{new Date(r.created_at).toLocaleString('es-PR')}</div></div><span className="badge">{r.status}</span></div>{r.intake_items?.map((item:any)=><div className="row" key={item.id}><Thumb path={item.label_photo_path} label={`${item.name} ${item.vintage||''}`}/><div><b>{item.name} {item.vintage||''}</b><div className="muted small">{item.quantity} botella(s) · {item.region||'Sin región'}</div></div></div>)}<div className="row"><button className="btn secondary" onClick={async()=>{await supabase.from('intake_requests').update({status:'reviewing'}).eq('id',r.id);load()}}>Revisando</button><button className="btn" onClick={async()=>{await supabase.from('intake_requests').update({status:'accepted',reviewed_at:new Date().toISOString()}).eq('id',r.id);load()}}>Aceptar entrada</button></div></div>)}</div>}</div>
}

export function AdminAccounts() {
  const [rows,setRows]=useState<any[]|null>(null); const load=()=>supabase.from('profiles').select('id,full_name,role,terms_accepted_at').order('full_name').then(async({data})=>{const {data:m}=await supabase.from('memberships').select('*');setRows((data??[]).map((p:any)=>({...p,membership:(m??[]).find((x:any)=>x.user_id===p.id)})))})
  useEffect(()=>{load()},[])
  return <div className="stack"><div><span className="landing-kicker">Superadmin</span><h1>Cuentas y membresías</h1></div>{rows===null?<Loading/>:<div className="list">{rows.map((r)=><div className="item" key={r.id}><div className="thumb" style={{width:44,height:44,borderRadius:22}}>{(r.full_name||'?')[0]}</div><div className="body"><b>{r.full_name||'Sin nombre'}</b><div className="muted small">{r.role} {r.membership?`· ${r.membership.plan} · ${r.membership.status}`:''}</div></div>{r.role!=='superadmin'&&<select value={r.role} onChange={async(e)=>{await supabase.from('profiles').update({role:e.target.value}).eq('id',r.id);load()}}><option value="pending">Pendiente</option><option value="member">Cliente</option><option value="admin">Admin</option></select>}</div>)}</div>}</div>
}
