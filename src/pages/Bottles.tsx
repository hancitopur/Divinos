import { useEffect, useMemo, useState } from 'react'
import { useSearchParams } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { money, useT } from '../lib/i18n'
import type { Bottle, BottleDetail, BottleStatus, Client, Wine } from '../lib/types'
import { Empty, Field, Loading, Loc, PhotoPicker, Sheet, StatusBadge, Thumb } from '../components/ui'
import { SlotPicker } from '../components/SlotPicker'

const STATUSES: BottleStatus[] = ['in_storage', 'sold', 'consumed', 'removed']

export function Bottles() {
  const { t, lang } = useT()
  const [params, setParams] = useSearchParams()
  const [rows, setRows] = useState<BottleDetail[] | null>(null)
  const [q, setQ] = useState('')
  const [status, setStatus] = useState<BottleStatus | 'all'>('in_storage')
  const [editing, setEditing] = useState<Partial<Bottle> | null>(null)
  const [adding, setAdding] = useState(false)
  const clientFilter = params.get('client')

  const load = () => supabase.from('bottle_details').select('*').order('updated_at', { ascending: false })
    .then(({ data }) => setRows((data ?? []) as BottleDetail[]))
  useEffect(() => { load() }, [])

  // Deep link from the rack map: /bottles?open=<bottleId>
  useEffect(() => {
    const open = params.get('open')
    if (open && rows) {
      const b = rows.find((r) => r.id === open)
      if (b) { setEditing(b); setStatus('all') }
      setParams({}, { replace: true })
    }
  }, [rows, params])

  const list = useMemo(() => {
    if (!rows) return []
    const s = q.trim().toLowerCase()
    return rows.filter((b) =>
      (status === 'all' || b.status === status) &&
      (!clientFilter || b.client_id === clientFilter) &&
      (!s || [b.wine_name, b.producer, b.client_name, b.rack_name, String(b.vintage ?? '')].join(' ').toLowerCase().includes(s)))
  }, [rows, q, status, clientFilter])

  const total = list.reduce((a, b) => ({ p: a.p + Number(b.purchase_price), s: a.s + Number(b.sale_price) }), { p: 0, s: 0 })

  return (
    <div className="stack">
      <div className="row between"><h1>{t('bottles')}</h1><span className="muted small">{list.length} · {money(total.s, lang)}</span></div>
      <input className="search" placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)} />
      <div className="chips">
        <button className={`chip ${status === 'all' ? 'active' : ''}`} onClick={() => setStatus('all')}>{t('all')}</button>
        {STATUSES.map((s) => <button key={s} className={`chip ${status === s ? 'active' : ''}`} onClick={() => setStatus(s)}>{t(`status_${s}` as any)}</button>)}
        {clientFilter && <button className="chip active" onClick={() => setParams({})}>✕ {rows?.find((r) => r.client_id === clientFilter)?.client_name ?? t('client')}</button>}
      </div>
      {rows === null ? <Loading /> : list.length === 0 ? <Empty /> : (
        <div className="list">
          {list.map((b) => (
            <div className="item" key={b.id} onClick={() => setEditing(b)}>
              <Thumb path={b.label_photo_path} />
              <div className="body">
                <div className="title">{b.wine_name}{b.vintage ? ` ${b.vintage}` : ''}</div>
                <div className="meta">{b.producer ? b.producer + ' · ' : ''}{b.client_name}</div>
                <div className="row" style={{ marginTop: 4, gap: 6 }}><StatusBadge status={b.status} /><Loc rack={b.rack_name} shelf={b.shelf} position={b.position} /></div>
              </div>
              <div style={{ textAlign: 'right' }}>
                <div className="bold">{money(b.sale_price, lang)}</div>
                <div className="muted small">{money(b.purchase_price, lang)}</div>
              </div>
            </div>
          ))}
        </div>
      )}
      <button className="fab" aria-label={t('newBottle')} onClick={() => setAdding(true)}>+</button>
      {editing && <BottleForm bottle={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />}
      {adding && <AddBottles onClose={() => setAdding(false)} onSaved={() => { setAdding(false); load() }} />}
    </div>
  )
}

function useWinesClients() {
  const [wines, setWines] = useState<Wine[]>([]); const [clients, setClients] = useState<Client[]>([])
  useEffect(() => {
    supabase.from('wines').select('*').order('name').then(({ data }) => setWines((data ?? []) as Wine[]))
    supabase.from('clients').select('*').eq('active', true).order('name').then(({ data }) => setClients((data ?? []) as Client[]))
  }, [])
  return { wines, clients }
}

const wineLabel = (w: Wine) => `${w.name}${w.vintage ? ' ' + w.vintage : ''}${w.producer ? ' — ' + w.producer : ''}`

/** Bulk intake: N identical bottles for one client, auto-placed in the first free slots of a rack. */
function AddBottles({ onClose, onSaved }: { onClose: () => void; onSaved: () => void }) {
  const { t } = useT()
  const { wines, clients } = useWinesClients()
  const [f, setF] = useState({ wine_id: '', client_id: '', qty: 1, purchase_price: '', sale_price: '', received_at: new Date().toISOString().slice(0, 10), notes: '' })
  const [slot, setSlot] = useState<string | null>(null)
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false)

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null)
    try {
      // Determine free slots starting at the chosen slot (or none)
      let slotIds: (string | null)[] = Array(f.qty).fill(null)
      if (slot) {
        const { data: s0 } = await supabase.from('slots').select('rack_id, shelf, position').eq('id', slot).single()
        const { data: all } = await supabase.from('slots').select('id, shelf, position').eq('rack_id', s0!.rack_id).order('shelf').order('position')
        const { data: occ } = await supabase.from('bottles').select('slot_id').eq('status', 'in_storage').not('slot_id', 'is', null)
        const taken = new Set((occ ?? []).map((o) => o.slot_id))
        const free = (all ?? []).filter((s) => !taken.has(s.id) && (s.shelf > s0!.shelf || (s.shelf === s0!.shelf && s.position >= s0!.position))).map((s) => s.id)
        slotIds = Array.from({ length: f.qty }, (_, i) => free[i] ?? null)
      }
      const rows = slotIds.map((slot_id) => ({
        wine_id: f.wine_id, client_id: f.client_id, slot_id,
        purchase_price: Number(f.purchase_price || 0), sale_price: Number(f.sale_price || 0),
        received_at: f.received_at, notes: f.notes || null,
      }))
      const { error } = await supabase.from('bottles').insert(rows); if (error) throw error
      onSaved()
    } catch (ex: any) { setErr(ex.message) } finally { setBusy(false) }
  }

  return (
    <Sheet title={t('newBottle')} onClose={onClose}>
      <form className="stack" onSubmit={save}>
        <Field label={t('wine')}>
          <select required value={f.wine_id} onChange={(e) => setF({ ...f, wine_id: e.target.value })}>
            <option value="">{t('selectWine')}</option>{wines.map((w) => <option key={w.id} value={w.id}>{wineLabel(w)}</option>)}
          </select>
        </Field>
        <Field label={t('client')}>
          <select required value={f.client_id} onChange={(e) => setF({ ...f, client_id: e.target.value })}>
            <option value="">{t('selectClient')}</option>{clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <div className="grid2">
          <Field label={t('addBottles')}><input type="number" min={1} max={200} value={f.qty} onChange={(e) => setF({ ...f, qty: Number(e.target.value) })} /></Field>
          <Field label={t('receivedAt')}><input type="date" value={f.received_at} onChange={(e) => setF({ ...f, received_at: e.target.value })} /></Field>
          <Field label={`${t('purchasePrice')} (${t('perBottle')})`}><input type="number" step="0.01" min={0} inputMode="decimal" value={f.purchase_price} onChange={(e) => setF({ ...f, purchase_price: e.target.value })} /></Field>
          <Field label={`${t('salePrice')} (${t('perBottle')})`}><input type="number" step="0.01" min={0} inputMode="decimal" value={f.sale_price} onChange={(e) => setF({ ...f, sale_price: e.target.value })} /></Field>
        </div>
        <Field label={t('notes')}><textarea rows={2} value={f.notes} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
        <div className="card"><SlotPicker value={slot} onPick={setSlot} /></div>
        {err && <div className="error">{err}</div>}
        <div className="actions">
          <button type="button" className="btn secondary" onClick={onClose}>{t('cancel')}</button>
          <button className="btn" disabled={busy}>{t('save')}</button>
        </div>
      </form>
    </Sheet>
  )
}

function BottleForm({ bottle, onClose, onSaved }: { bottle: Partial<Bottle>; onClose: () => void; onSaved: () => void }) {
  const { t } = useT()
  const { wines, clients } = useWinesClients()
  const [f, setF] = useState<Partial<Bottle>>({ ...bottle })
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false)

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null)
    const payload = {
      wine_id: f.wine_id, client_id: f.client_id, slot_id: f.status === 'in_storage' ? f.slot_id ?? null : null,
      purchase_price: Number(f.purchase_price ?? 0), sale_price: Number(f.sale_price ?? 0), status: f.status,
      received_at: f.received_at, released_at: f.released_at || null, label_photo_path: f.label_photo_path ?? null, notes: f.notes || null,
    }
    const { error } = await supabase.from('bottles').update(payload).eq('id', bottle.id!)
    setBusy(false); if (error) setErr(error.message); else onSaved()
  }
  const remove = async () => {
    if (!confirm(t('confirmDelete'))) return
    const { error } = await supabase.from('bottles').delete().eq('id', bottle.id!)
    if (error) setErr(error.message); else onSaved()
  }

  return (
    <Sheet title={t('edit')} onClose={onClose}>
      <form className="stack" onSubmit={save}>
        <Field label={t('wine')}>
          <select required value={f.wine_id ?? ''} onChange={(e) => setF({ ...f, wine_id: e.target.value })}>
            {wines.map((w) => <option key={w.id} value={w.id}>{wineLabel(w)}</option>)}
          </select>
        </Field>
        <Field label={t('client')}>
          <select required value={f.client_id ?? ''} onChange={(e) => setF({ ...f, client_id: e.target.value })}>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
        </Field>
        <div className="grid2">
          <Field label={t('purchasePrice')}><input type="number" step="0.01" min={0} inputMode="decimal" value={f.purchase_price ?? ''} onChange={(e) => setF({ ...f, purchase_price: Number(e.target.value) })} /></Field>
          <Field label={t('salePrice')}><input type="number" step="0.01" min={0} inputMode="decimal" value={f.sale_price ?? ''} onChange={(e) => setF({ ...f, sale_price: Number(e.target.value) })} /></Field>
          <Field label={t('status')}>
            <select value={f.status} onChange={(e) => setF({ ...f, status: e.target.value as BottleStatus })}>
              {STATUSES.map((s) => <option key={s} value={s}>{t(`status_${s}` as any)}</option>)}
            </select>
          </Field>
          <Field label={t('receivedAt')}><input type="date" value={f.received_at ?? ''} onChange={(e) => setF({ ...f, received_at: e.target.value })} /></Field>
        </div>
        {f.status === 'in_storage' && <div className="card"><SlotPicker value={f.slot_id ?? null} currentBottleId={bottle.id} onPick={(s) => setF({ ...f, slot_id: s })} /></div>}
        <Field label={t('notes')}><textarea rows={2} value={f.notes ?? ''} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
        <Field label={t('labelPhoto')}><PhotoPicker path={f.label_photo_path} prefix={`bottles/${bottle.id}`} onUploaded={(p) => setF({ ...f, label_photo_path: p })} /></Field>
        {err && <div className="error">{err}</div>}
        <div className="actions">
          <button type="button" className="btn danger" onClick={remove}>{t('delete')}</button>
          <button type="button" className="btn secondary" onClick={onClose}>{t('cancel')}</button>
          <button className="btn" disabled={busy}>{t('save')}</button>
        </div>
      </form>
    </Sheet>
  )
}
