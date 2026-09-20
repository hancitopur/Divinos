import { useEffect, useMemo, useState } from 'react'
import { Empty, Field, Loading, PhotoPicker, Thumb } from '../components/ui'
import { supabase } from '../lib/supabase'

const conditions: Record<string, string> = {
  good: 'Buena condición', label_damage: 'Etiqueta afectada', capsule_damage: 'Cápsula afectada',
  low_fill: 'Nivel bajo', leak: 'Posible filtración', other: 'Otra condición',
}

type IntakeItem = {
  id: string; request_id: string; name: string; producer?: string | null; vintage?: number | null
  quantity: number; received_quantity: number; accepted_quantity: number; condition?: string | null
  label_photo_path?: string | null; bottle_photo_path?: string | null; verification_notes?: string | null
}

type Intake = {
  id: string; client_id: string; status: string; receipt_code?: string | null; created_at: string
  declared_total?: number; received_total?: number; accepted_total?: number; discrepancy_total?: number
  customer_acknowledgment_name?: string | null; evidence_id?: string | null
  clients?: { name?: string | null } | null; intake_items?: IntakeItem[]
}

const total = (items: IntakeItem[], key: 'quantity'|'received_quantity'|'accepted_quantity') =>
  items.reduce((sum, item) => sum + Number(item[key] || 0), 0)

export function AdminIntakes() {
  const [requests, setRequests] = useState<Intake[] | null>(null)
  const [clients, setClients] = useState<any[]>([])
  const [selectedId, setSelectedId] = useState<string | null>(null)
  const [newClient, setNewClient] = useState('')
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState('')
  const [customerName, setCustomerName] = useState('')
  const [acknowledged, setAcknowledged] = useState(false)
  const [adding, setAdding] = useState(false)
  const [draft, setDraft] = useState({ name:'', producer:'', vintage:'', quantity:'1', received:'1', accepted:'1', condition:'good', label:'', bottle:'', notes:'' })

  const load = async (preferId?: string) => {
    const [{ data: intakeData, error: intakeError }, { data: clientData }] = await Promise.all([
      supabase.from('intake_requests').select('*, clients(name), intake_items(*)').order('created_at', { ascending:false }),
      supabase.from('clients').select('id,name,email').eq('active', true).order('name'),
    ])
    if (intakeError) setError(intakeError.message)
    const rows = (intakeData ?? []) as Intake[]
    setRequests(rows); setClients(clientData ?? [])
    const next = preferId ?? selectedId ?? rows.find((row)=>row.status !== 'accepted')?.id ?? rows[0]?.id ?? null
    setSelectedId(next)
    const request = rows.find((row)=>row.id === next)
    if (request?.customer_acknowledgment_name) setCustomerName(request.customer_acknowledgment_name)
  }
  useEffect(()=>{ void load() },[])

  const request = requests?.find((row)=>row.id === selectedId) ?? null
  const items = request?.intake_items ?? []
  const declared = total(items, 'quantity'), received = total(items, 'received_quantity'), accepted = total(items, 'accepted_quantity')
  const discrepancy = Math.abs(declared - received) + Math.max(0, received - accepted)
  const complete = request?.status === 'accepted'
  const verified = items.length > 0 && items.every((item)=>item.condition && item.bottle_photo_path && item.received_quantity >= item.accepted_quantity)

  const startReception = async () => {
    if (!newClient) { setError('Selecciona el cliente.'); return }
    setBusy(true); setError('')
    const { data: auth } = await supabase.auth.getUser()
    const { data, error: createError } = await supabase.from('intake_requests').insert({
      client_id:newClient, submitted_by:auth.user!.id, status:'reviewing', received_at:new Date().toISOString(),
    }).select('id').single()
    if (!createError && data) await supabase.from('intake_events').insert({request_id:data.id, action:'receiving_started', actor_id:auth.user!.id, snapshot:{source:'physical_walk_in'}})
    setBusy(false)
    if (createError) { setError(createError.message); return }
    setNewClient(''); await load(data.id)
  }

  const updateItem = async (item: IntakeItem, patch: Partial<IntakeItem>) => {
    const next = { ...item, ...patch }
    const { data: auth } = await supabase.auth.getUser()
    const { error: updateError } = await supabase.from('intake_items').update({
      received_quantity:Number(next.received_quantity), accepted_quantity:Number(next.accepted_quantity),
      condition:next.condition, bottle_photo_path:next.bottle_photo_path || null,
      label_photo_path:next.label_photo_path || null, verification_notes:next.verification_notes || null,
      verified_at:new Date().toISOString(), verified_by:auth.user!.id,
    }).eq('id',item.id)
    if (updateError) setError(updateError.message); else await load(request!.id)
  }

  const addItem = async () => {
    if (!request || !draft.name.trim()) { setError('Escribe el nombre del vino.'); return }
    setBusy(true); setError('')
    const { data: auth } = await supabase.auth.getUser()
    const { error: addError } = await supabase.from('intake_items').insert({
      request_id:request.id, client_id:request.client_id, name:draft.name.trim(), producer:draft.producer.trim() || null,
      vintage:draft.vintage ? Number(draft.vintage) : null, quantity:Number(draft.quantity),
      received_quantity:Number(draft.received), accepted_quantity:Number(draft.accepted), condition:draft.condition,
      label_photo_path:draft.label || null, bottle_photo_path:draft.bottle || null,
      verification_notes:draft.notes.trim() || null, verified_at:new Date().toISOString(), verified_by:auth.user!.id,
    })
    setBusy(false)
    if (addError) { setError(addError.message); return }
    setDraft({ name:'',producer:'',vintage:'',quantity:'1',received:'1',accepted:'1',condition:'good',label:'',bottle:'',notes:'' })
    setAdding(false); await load(request.id)
  }

  const finalize = async () => {
    if (!request || !acknowledged || !customerName.trim()) return
    setBusy(true); setError('')
    const { error: finalError } = await supabase.rpc('finalize_intake_receipt', {
      p_request_id:request.id, p_customer_name:customerName.trim(), p_acknowledged:true,
    })
    setBusy(false)
    if (finalError) { setError(finalError.message); return }
    setAcknowledged(false); await load(request.id)
  }

  const open = useMemo(()=>requests?.filter((row)=>row.status !== 'accepted') ?? [],[requests])
  const closed = useMemo(()=>requests?.filter((row)=>row.status === 'accepted') ?? [],[requests])

  return <div className="intake-desk">
    <div className="intake-title"><div><span className="landing-kicker">Cadena de custodia</span><h1>Recibir colección</h1><p>Cuenta, fotografía y confirma antes de añadir al inventario.</p></div></div>

    <section className="intake-new">
      <div><b>Nueva recepción</b><small>Cliente que llegó a la cava</small></div>
      <select aria-label="Cliente" value={newClient} onChange={(event)=>setNewClient(event.target.value)}><option value="">Selecciona cliente</option>{clients.map((client)=><option key={client.id} value={client.id}>{client.name}</option>)}</select>
      <button className="btn" disabled={busy || !newClient} onClick={startReception}>Comenzar</button>
    </section>

    <div className="intake-workspace">
      <aside className="intake-queue">
        <h2>Pendientes <span>{open.length}</span></h2>
        {requests === null ? <Loading/> : open.length === 0 ? <p className="muted small">No hay recepciones pendientes.</p> : open.map((row)=><button key={row.id} className={row.id===selectedId?'active':''} onClick={()=>{setSelectedId(row.id);setCustomerName('');setAcknowledged(false)}}><b>{row.clients?.name || 'Cliente'}</b><small>{row.receipt_code} · {new Date(row.created_at).toLocaleDateString('es-PR')}</small></button>)}
        {closed.length > 0 && <><h2 className="closed-title">Completadas</h2>{closed.slice(0,8).map((row)=><button key={row.id} className={row.id===selectedId?'active':''} onClick={()=>setSelectedId(row.id)}><b>{row.clients?.name || 'Cliente'}</b><small>{row.receipt_code} · {row.accepted_total} aceptadas</small></button>)}</>}
      </aside>

      <main className="intake-panel">
        {!request ? <Empty/> : <>
          <div className="intake-panel-head"><div><small>{request.receipt_code}</small><h2>{request.clients?.name}</h2></div><span className={`badge ${complete?'active':'pending'}`}>{complete?'Recibo final':'En verificación'}</span></div>
          <div className="intake-steps"><span className="done"><b>1</b> Cliente</span><i/><span className={items.length?'done':'active'}><b>2</b> Verificar</span><i/><span className={complete?'done':'active'}><b>3</b> Confirmar</span></div>
          <div className="intake-counts"><div><small>Declaradas</small><b>{complete?request.declared_total:declared}</b></div><div><small>Recibidas</small><b>{complete?request.received_total:received}</b></div><div><small>Aceptadas</small><b>{complete?request.accepted_total:accepted}</b></div><div className={(complete?request.discrepancy_total:discrepancy)?'warn':''}><small>Diferencia</small><b>{complete?request.discrepancy_total:discrepancy}</b></div></div>

          <div className="intake-items-head"><h3>Botellas recibidas</h3>{!complete&&<button className="btn secondary sm" onClick={()=>setAdding(!adding)}>+ Añadir vino</button>}</div>
          {adding && <section className="intake-add"><div className="grid2"><Field label="Vino"><input required value={draft.name} onChange={(e)=>setDraft({...draft,name:e.target.value})}/></Field><Field label="Productor"><input value={draft.producer} onChange={(e)=>setDraft({...draft,producer:e.target.value})}/></Field><Field label="Añada"><input type="number" inputMode="numeric" value={draft.vintage} onChange={(e)=>setDraft({...draft,vintage:e.target.value})}/></Field><Field label="Condición"><select value={draft.condition} onChange={(e)=>setDraft({...draft,condition:e.target.value})}>{Object.entries(conditions).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></Field></div><div className="intake-qty-row"><Field label="Declaró"><input type="number" min="1" value={draft.quantity} onChange={(e)=>setDraft({...draft,quantity:e.target.value})}/></Field><Field label="Recibimos"><input type="number" min="0" value={draft.received} onChange={(e)=>setDraft({...draft,received:e.target.value})}/></Field><Field label="Aceptamos"><input type="number" min="0" value={draft.accepted} onChange={(e)=>setDraft({...draft,accepted:e.target.value})}/></Field></div><div className="intake-photos"><Field label="Foto de etiqueta"><PhotoPicker path={draft.label} prefix={`intakes/${request.id}/labels`} onUploaded={(path)=>setDraft({...draft,label:path})}/></Field><Field label="Foto de todas las botellas *"><PhotoPicker path={draft.bottle} prefix={`intakes/${request.id}/received`} onUploaded={(path)=>setDraft({...draft,bottle:path})}/></Field></div><Field label="Observación"><textarea rows={2} value={draft.notes} onChange={(e)=>setDraft({...draft,notes:e.target.value})}/></Field><button className="btn" disabled={busy || !draft.name.trim() || !draft.bottle} onClick={addItem}>Guardar botella</button></section>}

          {items.length===0 ? <p className="intake-empty">Añade cada tipo de vino y fotografía juntas todas las botellas de esa línea.</p> : <div className="intake-verify-list">{items.map((item)=><IntakeItemEditor key={item.id} item={item} locked={complete} onSave={updateItem}/>)}</div>}

          {complete ? <section className="intake-receipt"><span>✓</span><div><small>Recibo verificado</small><h3>{request.receipt_code}</h3><p>{request.accepted_total} botellas añadidas al inventario · {request.discrepancy_total ? `${request.discrepancy_total} diferencia(s) documentada(s)` : 'sin diferencias'}</p><code>{request.evidence_id}</code></div></section> : <section className="intake-confirm"><h3>Confirmación final</h3><p>El cliente revisa el conteo y confirma lo recibido antes de irse.</p><Field label="Nombre completo del cliente"><input value={customerName} onChange={(e)=>setCustomerName(e.target.value)} autoComplete="name"/></Field><label className="terms-check"><input type="checkbox" checked={acknowledged} onChange={(e)=>setAcknowledged(e.target.checked)}/><span>El cliente confirma que las cantidades, fotografías y condiciones mostradas describen lo entregado a Divinos.</span></label>{discrepancy>0&&<div className="warning"><b>Hay {discrepancy} diferencia(s).</b> Quedarán impresas en el recibo.</div>}<button className="btn intake-final" disabled={busy||!verified||!acknowledged||!customerName.trim()} onClick={finalize}>{busy?'Generando recibo…':`Confirmar y añadir ${accepted} al inventario`}</button>{!verified&&<small className="muted">Cada línea necesita conteo, condición y foto de las botellas.</small>}</section>}
        </>}
      </main>
    </div>
    {error&&<div className="error intake-error">{error}</div>}
  </div>
}

function IntakeItemEditor({ item, locked, onSave }:{item:IntakeItem;locked:boolean;onSave:(item:IntakeItem,patch:Partial<IntakeItem>)=>Promise<void>}) {
  const [form,setForm]=useState({...item})
  useEffect(()=>setForm({...item}),[item])
  return <article className={`intake-item-card ${form.bottle_photo_path&&form.condition?'verified':''}`}>
    <div className="intake-item-title"><Thumb path={form.bottle_photo_path||form.label_photo_path} label={`${form.name} ${form.vintage||''}`}/><div><b>{form.name} {form.vintage||''}</b><small>{form.producer||'Productor no indicado'}</small></div>{form.bottle_photo_path&&form.condition&&<span>✓ Verificada</span>}</div>
    <div className="intake-qty-row"><Field label="Declaró"><input type="number" value={form.quantity} disabled/></Field><Field label="Recibimos"><input type="number" min="0" max="200" disabled={locked} value={form.received_quantity} onChange={(e)=>setForm({...form,received_quantity:Number(e.target.value)})}/></Field><Field label="Aceptamos"><input type="number" min="0" max={form.received_quantity} disabled={locked} value={form.accepted_quantity} onChange={(e)=>setForm({...form,accepted_quantity:Number(e.target.value)})}/></Field></div>
    <Field label="Condición"><select disabled={locked} value={form.condition||''} onChange={(e)=>setForm({...form,condition:e.target.value})}><option value="">Selecciona</option>{Object.entries(conditions).map(([value,label])=><option key={value} value={value}>{label}</option>)}</select></Field>
    {!locked&&<div className="intake-photos"><Field label="Foto de etiqueta"><PhotoPicker path={form.label_photo_path} prefix={`intakes/${item.request_id}/${item.id}/label`} onUploaded={(path)=>setForm({...form,label_photo_path:path})}/></Field><Field label="Foto de todas las botellas *"><PhotoPicker path={form.bottle_photo_path} prefix={`intakes/${item.request_id}/${item.id}/received`} onUploaded={(path)=>setForm({...form,bottle_photo_path:path})}/></Field></div>}
    <Field label="Observación"><textarea rows={2} disabled={locked} value={form.verification_notes||''} onChange={(e)=>setForm({...form,verification_notes:e.target.value})}/></Field>
    {!locked&&<button className="btn secondary" disabled={!form.condition||!form.bottle_photo_path||form.accepted_quantity>form.received_quantity} onClick={()=>onSave(item,form)}>Guardar verificación</button>}
  </article>
}
