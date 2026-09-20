import { useEffect, useMemo, useState } from 'react'
import { Link, useParams, useSearchParams } from 'react-router-dom'
import { Empty, Field, Loading, PhotoPicker, Thumb } from '../components/ui'
import { useAuth } from '../lib/auth'
import { money, useT } from '../lib/i18n'
import { supabase } from '../lib/supabase'
import type { BottleDetail, IntakeRequest, Membership, StorageSummary, WineType } from '../lib/types'
import { importWineImage, searchWineImages, type WineImageResult } from '../lib/wineImages'

const planName = (plan?: string) => ({ digital: 'Digital', reserva: 'Reserva', coleccion: 'Colección' }[plan || ''] || 'Divinos')
const storePhoto = (name='') => {
  const key=name.toLowerCase()
  if(key.includes('artemis')) return '/wine-products/artemis-2021.webp'
  if(key.includes('tignanello')) return '/wine-products/tignanello-2020.webp'
  if(key.includes('gran reserva 904')) return '/wine-products/gran-reserva-904-2015.webp'
  if(key.includes('erdener')) return '/wine-products/erdener-pralat-2020.webp'
  return ''
}

function LabelLightbox({ path, photo, name, onClose }: { path?: string | null; photo?: string; name: string; onClose: () => void }) {
  useEffect(() => {
    const previous=document.body.style.overflow; document.body.style.overflow='hidden'
    const close=(event:KeyboardEvent)=>{if(event.key==='Escape')onClose()}; window.addEventListener('keydown',close)
    return()=>{document.body.style.overflow=previous;window.removeEventListener('keydown',close)}
  },[onClose])
  return <div className="label-lightbox" role="dialog" aria-modal="true" aria-label={`Etiqueta de ${name}`} onClick={onClose}>
    <button type="button" className="label-lightbox-close" aria-label="Cerrar etiqueta" onClick={onClose}>×</button>
    <div className="label-lightbox-image" onClick={event=>event.stopPropagation()}>{path?<Thumb path={path} className="lg" label={`Etiqueta de ${name}`}/>:<img src={photo} alt={`Etiqueta ampliada de ${name}`}/>}</div>
    <p>Toca fuera de la etiqueta para cerrar</p>
  </div>
}

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
    <Link className="btn client-primary" to="/intake">Solicitar entrada de botellas</Link>
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
  return <div className="stack client-page"><div><span className="landing-kicker">Solicitud del cliente</span><h1>Solicitar entrada de botellas</h1><p className="muted">Busca la etiqueta o toma una foto para enviar la información. Esto no crea productos ni añade botellas al inventario: un administrador debe revisar y aprobar la solicitud.</p></div>
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
      {error&&<div className="error">{error}</div>}<button className="btn" disabled={busy}>{busy?'Enviando…':`Enviar solicitud de ${form.quantity} botella${Number(form.quantity)===1?'':'s'}`}</button>
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

export function ClientShop() {
  const { session,membership,profile }=useAuth(); const { lang }=useT(); const [params]=useSearchParams()
  const [offers,setOffers]=useState<any[]|null>(null); const [age,setAge]=useState(false); const [busy,setBusy]=useState<string|null>(null)
  const [message,setMessage]=useState<{type:'ok'|'error';text:string}|null>(null)
  const [zoom,setZoom]=useState<{path?:string|null;photo?:string;name:string}|null>(null)
  const load=()=>supabase.from('wine_sale_offers').select('*, wines(*)').eq('active',true).order('featured',{ascending:false}).order('member_release_at',{ascending:false}).then(({data})=>setOffers(data??[]))
  useEffect(()=>{load()},[])
  useEffect(()=>{
    if(params.get('paypal')!=='return') return
    const token=new URLSearchParams(window.location.search).get('token'); if(!token)return
    setBusy('capture');setMessage(null)
    supabase.functions.invoke('paypal-capture-wine',{body:{paypalOrderId:token}}).then(({data,error})=>{
      if(error||data?.error)setMessage({type:'error',text:data?.error||error?.message||'No se pudo confirmar el pago.'})
      else setMessage({type:'ok',text:data.pickup?'Compra confirmada. Te avisaremos cuando esté lista para recogido.':`Compra confirmada. ${data.bottles||1} botella(s) ubicada(s) en ${data.locations?.join(', ')||'tu cava'}.`})
      setBusy(null);load()
    })
  },[])
  const staffPreview=profile?.role==='admin'||profile?.role==='superadmin'
  const activeMember=membership?.status==='active'
  const physical=activeMember&&(membership?.plan==='reserva'||membership?.plan==='coleccion')
  const checkout=async(offerId:string,mode:'storage'|'pickup')=>{if(!session){window.location.hash=`#/login?next=${encodeURIComponent(`/shop/${offerId}`)}`;return}setBusy(offerId);setMessage(null);const {data,error}=await supabase.functions.invoke('paypal-wine-order',{body:{offerId,quantity:1,acceptAge:age,fulfillment:mode}});if(error||data?.error){setMessage({type:'error',text:data?.error||error?.message||'No se pudo iniciar el pago.'});setBusy(null)}else window.location.href=data.approval_url}
  return <div className="stack client-page private-shop">
    <div className="shop-hero"><span className="landing-kicker">Tienda Divinos</span><h1>Compra. Guarda. Disfruta.</h1><p>Elige tu botella y envíala directo a tu cava.</p>{activeMember&&!staffPreview&&<Link className="btn secondary" to="/sell">Vender de mi colección</Link>}</div>
    {message&&<div className={message.type==='ok'?'info':'error'}>{message.text}</div>}
    <div className="shop-status">{staffPreview?'Vista administrativa · compra desactivada':activeMember?'✓ Precio de miembro activo':session?'Precio regular · recogido disponible':'Explora sin registro · crea tu cuenta solamente al comprar'}</div>
    {session&&!staffPreview&&<label className="terms-check shop-age"><input type="checkbox" checked={age} onChange={(e)=>setAge(e.target.checked)} /> Confirmo que tengo 18 años o más.</label>}
    {offers===null?<Loading/>:offers.length===0?<div className="client-success"><span>◌</span><h2>Próximamente</h2><p>Las nuevas llegadas aparecerán aquí primero para los miembros de Divinos.</p></div>:<div className="shop-grid">{offers.map((offer)=>{
      const wine=Array.isArray(offer.wines)?offer.wines[0]:offer.wines; const left=offer.quantity_available-offer.quantity_reserved-offer.quantity_sold
      const basePrice=Number(offer.price),memberPrice=Math.round(basePrice*107.5)/100,regularPrice=Math.round(basePrice*1.15*107.5)/100,total=activeMember?memberPrice:regularPrice
      const photo=storePhoto(wine?.name)
      return <article className={offer.featured?'featured':''} key={offer.id}>
        <div className="shop-gallery">
          <Link className="shop-bottle-view" to={`/shop/${offer.id}`} aria-label={`Ver detalles de ${wine?.name||'vino'}`}>{wine?.bottle_photo_path?<Thumb path={wine.bottle_photo_path} label={wine?.name}/>:photo?<img src={photo} alt={`Botella de ${wine?.name||'vino'}`}/>:<div className="shop-bottle-fallback"><i/><span>{wine?.producer||'DIVINOS'}</span></div>}</Link>
          <button type="button" className="shop-label-view" aria-label={`Ampliar etiqueta de ${wine?.name||'vino'}`} onClick={()=>setZoom({path:wine?.label_photo_path,photo,name:wine?.name||'vino'})}>{wine?.label_photo_path?<Thumb path={wine.label_photo_path} label={`${wine?.name||'Vino'} ${wine?.vintage||''}`} />:photo?<img src={photo} alt={`Etiqueta de ${wine?.name||'vino'}`}/>:null}<small>Ampliar etiqueta</small></button>
          {offer.featured&&<span>Selección Divinos</span>}
        </div>
        <div className="shop-copy"><small>{offer.offer_source==='member'?'Colección de miembro':'Inventario Divinos'}</small><h2><Link to={`/shop/${offer.id}`}>{wine?.name}</Link></h2><p className="shop-origin">{[wine?.producer,wine?.region,wine?.country,wine?.vintage].filter(Boolean).join(' · ')}</p>
          <div className="shop-price"><strong>{money(total,lang)}</strong><span>Precio final · servicio incluido</span></div>
          {!activeMember&&<div className="member-price-note">Miembros: {money(memberPrice,lang)}</div>}
          <Link className="product-detail-link" to={`/shop/${offer.id}`}>Ver detalles y reseñas →</Link>
          <div className="shop-buy-actions">{physical&&<button className="btn" disabled={staffPreview||!age||left<1||busy!==null} onClick={()=>checkout(offer.id,'storage')}>{busy===offer.id?'Conectando…':'Comprar y guardar'}</button>}<button className={physical?'btn secondary':'btn'} disabled={staffPreview||(!!session&&!age)||left<1||busy!==null} onClick={()=>checkout(offer.id,'pickup')}>{staffPreview?'Vista previa':!session?'Comprar':busy===offer.id?'Conectando…':'Comprar para recoger'}</button></div>
          <div className="shop-availability"><span>{left} disponible{left===1?'':'s'}</span>{physical&&<span>Se añade automáticamente a tu inventario</span>}</div>
        </div>
      </article>
    })}</div>}
    <p className="muted small shop-legal">Precio final con servicio incluido. “Comprar y guardar” añade la botella automáticamente a tu inventario cuando PayPal confirma el pago.</p>{zoom&&<LabelLightbox {...zoom} onClose={()=>setZoom(null)}/>} 
  </div>
}

export function ClientProductDetail() {
  const { offerId }=useParams(); const { session,membership,profile }=useAuth(); const { lang }=useT()
  const [offer,setOffer]=useState<any|null>(null); const [loading,setLoading]=useState(true); const [related,setRelated]=useState<any[]>([]); const [reviews,setReviews]=useState<any[]>([]); const [zoom,setZoom]=useState(false)
  const [age,setAge]=useState(false); const [busy,setBusy]=useState(false); const [error,setError]=useState<string|null>(null)
  const activeMember=membership?.status==='active',physical=activeMember&&(membership?.plan==='reserva'||membership?.plan==='coleccion'),staffPreview=profile?.role==='admin'||profile?.role==='superadmin'
  useEffect(()=>{if(!offerId){setLoading(false);return};setLoading(true);(async()=>{const {data,error:e}=await supabase.from('wine_sale_offers').select('*, wines(*)').eq('id',offerId).eq('active',true).maybeSingle();if(e)setError('No pudimos abrir este producto. Intenta nuevamente.');setOffer(data);if(data){const wine=Array.isArray(data.wines)?data.wines[0]:data.wines;const [{data:r},{data:rel}]=await Promise.all([supabase.from('wine_reviews').select('*').eq('wine_id',wine.id).order('created_at',{ascending:false}).limit(3),supabase.from('wine_sale_offers').select('*, wines(*)').eq('active',true).neq('id',data.id).order('featured',{ascending:false}).limit(3)]);setReviews(r??[]);setRelated(rel??[])}setLoading(false)})()},[offerId])
  if(loading)return <Loading/>
  if(!offer)return <div className="client-page product-missing"><h1>Producto no disponible</h1><p>{error||'La botella ya no está activa en la tienda.'}</p><Link className="btn" to="/shop">Volver a la tienda</Link></div>
  const wine=Array.isArray(offer.wines)?offer.wines[0]:offer.wines,photo=storePhoto(wine?.name),left=offer.quantity_available-offer.quantity_reserved-offer.quantity_sold
  const base=Number(offer.price),memberPrice=Math.round(base*107.5)/100,regularPrice=Math.round(base*1.15*107.5)/100,total=activeMember?memberPrice:regularPrice
  const checkout=async(mode:'storage'|'pickup')=>{if(!session){window.location.hash=`#/login?next=${encodeURIComponent(`/shop/${offer.id}`)}`;return}setBusy(true);setError(null);const {data,error:e}=await supabase.functions.invoke('paypal-wine-order',{body:{offerId:offer.id,quantity:1,acceptAge:age,fulfillment:mode}});if(e||data?.error){setError(data?.error||e?.message||'No se pudo iniciar el pago.');setBusy(false)}else window.location.href=data.approval_url}
  return <div className="product-detail client-page">
    <Link className="product-back" to="/shop">← Volver a la tienda</Link>
    <section className="product-main">
      <div className="product-photo">{wine?.bottle_photo_path?<Thumb path={wine.bottle_photo_path} label={wine.name}/>:<img src={photo} alt={`Botella de ${wine?.name}`}/>}<button type="button" className="product-label-zoom" aria-label={`Ampliar etiqueta de ${wine?.name}`} onClick={()=>setZoom(true)}>{wine?.label_photo_path?<Thumb path={wine.label_photo_path} label={`Etiqueta de ${wine.name}`}/>:<img src={photo} alt={`Etiqueta de ${wine?.name}`}/>}<span>Ampliar</span></button></div>
      <div className="product-buy"><span className="landing-kicker">{offer.offer_source==='member'?'Colección de miembro':'Selección Divinos'}</span><h1>{wine?.name}</h1><p className="product-origin">{[wine?.producer,wine?.region,wine?.country,wine?.vintage].filter(Boolean).join(' · ')}</p><p>{String(offer.description||'').replace(/^\[DEMO\]\s*/,'')}</p>
        <div className="product-price"><strong>{money(total,lang)}</strong><span>Precio final · servicio incluido</span></div>{!activeMember&&<p className="member-price-note">Precio miembro: {money(memberPrice,lang)}</p>}
        {session&&!staffPreview&&<label className="terms-check product-age"><input type="checkbox" checked={age} onChange={e=>setAge(e.target.checked)}/> Confirmo que tengo 18 años o más.</label>}
        {!session&&<div className="public-checkout-note">No necesitas cuenta para mirar. Te pediremos crearla cuando continúes la compra.</div>}
        <div className="product-actions">{physical&&<button className="btn" disabled={!age||busy||left<1} onClick={()=>checkout('storage')}>{busy?'Conectando…':'Comprar y guardar'}</button>}<button className={physical?'btn secondary':'btn'} disabled={staffPreview||(!!session&&!age)||busy||left<1} onClick={()=>checkout('pickup')}>{staffPreview?'Vista previa':!session?'Comprar ahora':busy?'Conectando…':'Comprar para recoger'}</button></div>
        {physical&&<div className="product-storage-note">✓ Al pagar, se añade a tu inventario y queda pendiente de ubicación.</div>}{error&&<div className="error">{error}</div>}<span className="badge">{left} disponible{left===1?'':'s'}</span>
      </div>
    </section>
    <section className="product-section"><div className="row between"><h2>Reseñas recientes</h2><span className="small muted">Últimas {reviews.length}</span></div><div className="review-grid">{reviews.map(review=><article key={review.id}><div className="review-head"><b>{review.reviewer_name}</b><span>{'★'.repeat(review.rating)}{'☆'.repeat(5-review.rating)}</span></div><p>{review.review_text}</p>{review.is_demo&&<small>Reseña de demostración</small>}</article>)}</div></section>
    <section className="product-section"><h2>También te puede gustar</h2><div className="related-grid">{related.map(item=>{const w=Array.isArray(item.wines)?item.wines[0]:item.wines,p=storePhoto(w?.name),price=activeMember?Math.round(Number(item.price)*107.5)/100:Math.round(Number(item.price)*1.15*107.5)/100;return <Link to={`/shop/${item.id}`} key={item.id}><img src={p} alt={w?.name}/><div><b>{w?.name}</b><small>{[w?.region,w?.country].filter(Boolean).join(' · ')}</small><strong>{money(price,lang)}</strong></div></Link>})}</div></section>{zoom&&<LabelLightbox path={wine?.label_photo_path} photo={photo} name={wine?.name||'vino'} onClose={()=>setZoom(false)}/>} 
  </div>
}

export function ClientSell() {
  const { clientId }=useAuth(); const { lang }=useT()
  const [bottles,setBottles]=useState<any[]|null>(null); const [requests,setRequests]=useState<any[]|null>(null)
  const [form,setForm]=useState({bottle_id:'',asking_price:'',notes:'',accepted:false}); const [busy,setBusy]=useState(false); const [message,setMessage]=useState<string|null>(null)
  const load=async()=>{
    const [{data:b},{data:r}]=await Promise.all([
      supabase.from('bottle_details').select('*').eq('status','in_storage').order('updated_at',{ascending:false}),
      supabase.from('member_sale_requests').select('*, bottles(id,label_photo_path,wines(name,vintage,producer))').order('created_at',{ascending:false})
    ])
    const rows=b??[],active=new Set((r??[]).filter((x:any)=>['pending','approved'].includes(x.status)).map((x:any)=>x.bottle_id))
    const available=rows.filter((x:any)=>!active.has(x.id));setBottles(available);setRequests(r??[])
    setForm(f=>({...f,bottle_id:available.some((x:any)=>x.id===f.bottle_id)?f.bottle_id:(available[0]?.id||'')}))
  }
  useEffect(()=>{load()},[])
  if(!clientId)return <div className="error">Tu cuenta todavía no está vinculada a una colección.</div>
  return <div className="stack client-page member-sell"><div><span className="landing-kicker">Marketplace de miembros</span><h1>Vender desde mi cava</h1><p className="muted">Selecciona una botella que ya esté almacenada. Divinos verifica el precio y decide si la publica; tú no creas productos ni ofertas directamente.</p></div>
    <form className="card stack" onSubmit={async(e)=>{e.preventDefault();if(!form.accepted)return;setBusy(true);setMessage(null);const {error}=await supabase.rpc('submit_member_sale_request',{p_bottle_id:form.bottle_id,p_asking_price:Number(form.asking_price),p_notes:form.notes||null});setBusy(false);if(error)setMessage(error.message);else{setMessage('Solicitud enviada para revisión.');setForm(f=>({...f,asking_price:'',notes:'',accepted:false}));load()}}}>
      <h2>Solicitar venta</h2>{bottles===null?<Loading/>:bottles.length===0?<p className="muted">No tienes botellas disponibles para solicitar venta.</p>:<><Field label="Botella"><select required value={form.bottle_id} onChange={e=>setForm({...form,bottle_id:e.target.value})}>{bottles.map(b=><option key={b.id} value={b.id}>{b.wine_name} {b.vintage||''} · {b.rack_name||'Sin rack'} S{b.shelf||'-'} P{b.position||'-'}</option>)}</select></Field><Field label="Precio que solicitas"><input required type="number" min="1" step="0.01" value={form.asking_price} onChange={e=>setForm({...form,asking_price:e.target.value})}/></Field><Field label="Notas para Divinos"><textarea rows={2} value={form.notes} onChange={e=>setForm({...form,notes:e.target.value})}/></Field><label className="terms-check"><input required type="checkbox" checked={form.accepted} onChange={e=>setForm({...form,accepted:e.target.checked})}/> Declaro que soy dueño de esta botella, autorizo a Divinos a verificarla y acepto los <Link to="/terms">términos del servicio</Link>.</label><button className="btn" disabled={busy||!form.accepted}>{busy?'Enviando…':'Enviar para aprobación'}</button></>}{message&&<div className="info">{message}</div>}
    </form>
    <h2>Mis solicitudes</h2>{requests===null?<Loading/>:requests.length===0?<Empty/>:<div className="list">{requests.map((r:any)=>{const wine=r.bottles?.wines;return <div className="item" key={r.id}><Thumb path={r.bottles?.label_photo_path} label={`${wine?.name||'Botella'} ${wine?.vintage||''}`}/><div className="body"><b>{wine?.name||'Botella'} {wine?.vintage||''}</b><div className="meta">Solicitado {money(r.asking_price,lang)}{r.approved_price?` · Aprobado ${money(r.approved_price,lang)}`:''}</div></div><span className="badge">{{pending:'Pendiente',approved:'Publicada',rejected:'No aprobada',cancelled:'Cancelada',sold:'Vendida'}[r.status as string]||r.status}</span>{r.status==='pending'&&<button className="btn secondary sm" onClick={async()=>{setBusy(true);const {error}=await supabase.rpc('cancel_member_sale_request',{p_request_id:r.id});setBusy(false);if(error)setMessage(error.message);else load()}}>Cancelar</button>}</div>})}</div>}
    <div className="legal-alert"><b>Liquidación al vendedor:</b> cuando se complete una venta, Divinos registrará el importe pendiente. El desembolso automático se habilitará al conectar una solución de pagos para marketplace.</div><Link className="btn secondary" to="/shop">Volver a la tienda</Link>
  </div>
}

export function AdminWineSales() {
  const { session }=useAuth(); const [wines,setWines]=useState<any[]>([]); const [offers,setOffers]=useState<any[]|null>(null)
  const [requests,setRequests]=useState<any[]|null>(null); const [reviewPrices,setReviewPrices]=useState<Record<string,string>>({})
  const [form,setForm]=useState({wine_id:'',price:'',quantity_available:'1',description:'',featured:false,regular_sale:true}); const [error,setError]=useState<string|null>(null)
  const load=async()=>{const [{data:w},{data:o},{data:r}]=await Promise.all([supabase.from('wines').select('id,name,vintage,producer').order('name'),supabase.from('wine_sale_offers').select('*, wines(name,vintage)').order('created_at',{ascending:false}),supabase.from('member_sale_requests').select('*, clients(name), bottles(id,label_photo_path,wines(name,vintage,producer))').order('created_at',{ascending:false})]);setWines(w??[]);setOffers(o??[]);setRequests(r??[]);setReviewPrices(prev=>Object.fromEntries((r??[]).map((x:any)=>[x.id,prev[x.id]||String(x.asking_price)])));if(!form.wine_id&&w?.[0])setForm(f=>({...f,wine_id:w[0].id}))}
  useEffect(()=>{load()},[])
  return <div className="stack"><div className="row between"><div><span className="landing-kicker">Inventario de venta</span><h1>Cava Privada</h1></div><div className="row"><Link className="btn secondary" to="/shop">Ver tienda</Link><Link className="btn secondary" to="/wines">Catálogo</Link></div></div>
    <form className="card stack" onSubmit={async(e)=>{e.preventDefault();setError(null);const {error}=await supabase.from('wine_sale_offers').insert({wine_id:form.wine_id,price:Number(form.price),quantity_available:Number(form.quantity_available),description:form.description||null,featured:form.featured,public_release_at:form.regular_sale?new Date().toISOString():null,created_by:session?.user.id});if(error)setError(error.message);else{setForm(f=>({...f,price:'',quantity_available:'1',description:'',featured:false}));load()}}}>
      <h2>Publicar nueva llegada</h2><Field label="Vino"><select required value={form.wine_id} onChange={e=>setForm({...form,wine_id:e.target.value})}>{wines.map(w=><option key={w.id} value={w.id}>{w.name} {w.vintage||''} · {w.producer||''}</option>)}</select></Field><div className="grid2"><Field label="Precio base interno"><input required type="number" min="1" step="0.01" value={form.price} onChange={e=>setForm({...form,price:e.target.value})}/><small className="muted">La tienda mostrará un solo precio final con el servicio incluido.</small></Field><Field label="Cantidad disponible"><input required type="number" min="1" value={form.quantity_available} onChange={e=>setForm({...form,quantity_available:e.target.value})}/></Field></div><Field label="Descripción"><textarea rows={2} value={form.description} onChange={e=>setForm({...form,description:e.target.value})}/></Field><label className="terms-check"><input type="checkbox" checked={form.featured} onChange={e=>setForm({...form,featured:e.target.checked})}/> Destacar esta llegada</label><label className="terms-check"><input type="checkbox" checked={form.regular_sale} onChange={e=>setForm({...form,regular_sale:e.target.checked})}/> Vender también a compradores regulares con precio 15% mayor</label>{error&&<div className="error">{error}</div>}<button className="btn">Publicar inventario</button>
    </form>
    <h2>Solicitudes de miembros</h2>{requests===null?<Loading/>:requests.filter(r=>r.status==='pending').length===0?<p className="muted">No hay solicitudes pendientes.</p>:<div className="list">{requests.filter(r=>r.status==='pending').map((r:any)=>{const wine=r.bottles?.wines;return <div className="item marketplace-review" key={r.id}><Thumb path={r.bottles?.label_photo_path} label={`${wine?.name||'Botella'} ${wine?.vintage||''}`}/><div className="body"><b>{wine?.name||'Botella'} {wine?.vintage||''}</b><div className="meta">{r.clients?.name||'Miembro'} solicita ${r.asking_price}{r.notes?` · ${r.notes}`:''}</div></div><input aria-label="Precio aprobado" type="number" min="1" step="0.01" value={reviewPrices[r.id]||''} onChange={e=>setReviewPrices({...reviewPrices,[r.id]:e.target.value})}/><button className="btn sm" onClick={async()=>{setError(null);const {error}=await supabase.rpc('review_member_sale_request',{p_request_id:r.id,p_action:'approve',p_approved_price:Number(reviewPrices[r.id]),p_description:`Botella verificada de la colección de ${r.clients?.name||'un miembro'}`,p_admin_notes:null});if(error)setError(error.message);else load()}}>Aprobar y publicar</button><button className="btn secondary sm" onClick={async()=>{const {error}=await supabase.rpc('review_member_sale_request',{p_request_id:r.id,p_action:'reject',p_approved_price:null,p_description:null,p_admin_notes:'No aprobada para publicación.'});if(error)setError(error.message);else load()}}>Rechazar</button></div>})}</div>}
    <h2>Ofertas publicadas</h2>{offers===null?<Loading/>:offers.length===0?<Empty/>:<div className="list">{offers.map(o=>{const w=Array.isArray(o.wines)?o.wines[0]:o.wines,base=Number(o.price),member=(base*1.075).toFixed(2),regular=(base*1.15*1.075).toFixed(2);return <div className="item" key={o.id}><div className="body"><b>{w?.name} {w?.vintage||''}</b><div className="meta">{o.offer_source==='member'?'Miembro':'Divinos'} · final miembro ${member} · final regular ${regular} · {o.quantity_sold} vendidas · {o.quantity_available} total</div></div><button className="btn secondary sm" onClick={async()=>{await supabase.from('wine_sale_offers').update({public_release_at:o.public_release_at?null:new Date().toISOString()}).eq('id',o.id);load()}}>{o.public_release_at?'Solo miembros':'Abrir regular'}</button><button className="btn secondary sm" onClick={async()=>{await supabase.from('wine_sale_offers').update({active:!o.active}).eq('id',o.id);load()}}>{o.active?'Pausar':'Activar'}</button></div>})}</div>}
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
