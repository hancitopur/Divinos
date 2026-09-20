import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { money, useT } from '../lib/i18n'
import type { BottleDetail, Client, Sale } from '../lib/types'
import { Empty, Loading } from '../components/ui'

export function Sales() {
  const { lang } = useT()
  const [inventory, setInventory] = useState<BottleDetail[] | null>(null)
  const [clients, setClients] = useState<Client[]>([])
  const [sales, setSales] = useState<Sale[]>([])
  const [cart, setCart] = useState<BottleDetail[]>([])
  const [clientId, setClientId] = useState('')
  const [q, setQ] = useState('')
  const [payment, setPayment] = useState('cash')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const load = async () => {
    const [{ data: stock }, { data: customerRows }, { data: saleRows }] = await Promise.all([
      supabase.from('bottle_details').select('*').eq('status', 'in_storage').order('updated_at', { ascending: false }),
      supabase.from('clients').select('*').eq('active', true).order('name'),
      supabase.from('sales').select('*').order('created_at', { ascending: false }).limit(20),
    ])
    setInventory((stock ?? []) as BottleDetail[]); setClients((customerRows ?? []) as Client[]); setSales((saleRows ?? []) as Sale[])
  }
  useEffect(() => { load() }, [])
  const filtered = useMemo(() => (inventory ?? []).filter(x => !cart.some(c => c.id === x.id) && [x.wine_name, x.producer, x.client_name, x.varietal].join(' ').toLowerCase().includes(q.toLowerCase())), [inventory, cart, q])
  const subtotal = cart.reduce((sum, item) => sum + Number(item.sale_price), 0)
  const tax = subtotal * .115; const total = subtotal + tax
  const checkout = async () => {
    if (!cart.length) return
    setBusy(true); setMessage(null)
    const { data, error } = await supabase.rpc('complete_sale', { p_bottle_ids: cart.map(x => x.id), p_client_id: clientId || null, p_payment_method: payment, p_notes: null })
    setBusy(false)
    if (error) return setMessage(error.message)
    setMessage(`Venta ${String(data).slice(0, 8).toUpperCase()} completada por ${money(total, lang)}.`); setCart([]); setClientId(''); await load()
  }
  return <div className="stack">
    <div className="row between"><div><h1>Punto de venta</h1><p className="muted small">Cobra cigarros y descuéntalos del humidor.</p></div><span className="badge">{inventory?.length ?? 0} disponibles</span></div>
    <div className="sales-layout">
      <section className="stack"><input className="search" placeholder="Buscar cigarro, marca, vitola o cliente…" value={q} onChange={e => setQ(e.target.value)} />
        {inventory === null ? <Loading /> : filtered.length === 0 ? <Empty /> : <div className="sale-products">{filtered.map(item => <button key={item.id} onClick={() => setCart([...cart, item])}><span><b>{item.wine_name}</b><small>{[item.producer, item.varietal].filter(Boolean).join(' · ')}</small></span><strong>{money(item.sale_price, lang)}</strong></button>)}</div>}
      </section>
      <aside className="card stack pos-cart"><h2>Venta actual</h2><select value={clientId} onChange={e => setClientId(e.target.value)}><option value="">Venta mostrador</option>{clients.map(c => <option value={c.id} key={c.id}>{c.name}</option>)}</select>
        {cart.length === 0 ? <p className="muted small">Selecciona productos del inventario.</p> : cart.map(item => <div className="row between" key={item.id}><span><b>{item.wine_name}</b><small>{item.producer}</small></span><span>{money(item.sale_price, lang)} <button className="cart-remove" onClick={() => setCart(cart.filter(x => x.id !== item.id))}>×</button></span></div>)}
        <div className="pos-totals"><div><span>Subtotal</span><b>{money(subtotal, lang)}</b></div><div><span>IVU 11.5%</span><b>{money(tax, lang)}</b></div><div className="grand"><span>Total</span><b>{money(total, lang)}</b></div></div>
        <select value={payment} onChange={e => setPayment(e.target.value)}><option value="cash">Efectivo</option><option value="card">Tarjeta</option><option value="ath_movil">ATH Móvil</option><option value="other">Otro</option></select>
        <button className="btn" disabled={!cart.length || busy} onClick={checkout}>{busy ? 'Procesando…' : 'Completar venta'}</button>{message && <div className={message.startsWith('Venta ') ? 'info' : 'error'}>{message}</div>}
      </aside>
    </div>
    <h2>Ventas recientes</h2>{sales.length === 0 ? <Empty /> : <div className="card table-wrap"><table className="table"><thead><tr><th>Fecha</th><th>Pago</th><th>Estado</th><th className="num">Total</th></tr></thead><tbody>{sales.map(s => <tr key={s.id}><td>{new Date(s.created_at).toLocaleString('es-PR')}</td><td>{s.payment_method}</td><td><span className="badge">{s.status}</span></td><td className="num">{money(s.total, lang)}</td></tr>)}</tbody></table></div>}
  </div>
}
