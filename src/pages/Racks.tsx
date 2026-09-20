import { useEffect, useState } from 'react'
import { useNavigate } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { useT } from '../lib/i18n'
import type { Rack } from '../lib/types'
import { Field, Sheet } from '../components/ui'
import { SlotPicker } from '../components/SlotPicker'

export function Racks() {
  const { t } = useT()
  const nav = useNavigate()
  const [racks, setRacks] = useState<Rack[]>([])
  const [editing, setEditing] = useState<Partial<Rack> | null>(null)
  const [view, setView] = useState<'cellar' | 'slots'>('cellar')
  const [key, setKey] = useState(0)

  const load = () => supabase.from('racks').select('*').order('name').then(({ data }) => { setRacks((data ?? []) as Rack[]); setKey((k) => k + 1) })
  useEffect(() => { load() }, [])

  return (
    <div className="stack">
      <div className="row between rack-page-head">
        <h1>{t('racks')}</h1>
        <div className="row rack-page-actions">
          {racks.length > 0 && <select onChange={(e) => { const r = racks.find((x) => x.id === e.target.value); if (r) setEditing(r) }} value="" style={{ border: '1px solid var(--line)', borderRadius: 8, padding: '6px 8px', background: '#fff' }}>
            <option value="">{t('edit')}…</option>{racks.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
          </select>}
          <button className="btn sm" onClick={() => setEditing({ shelves: 4, positions_per_shelf: 8 })}>+ {t('newRack')}</button>
        </div>
      </div>
      <div className="rack-view-switch" role="group" aria-label={t('racks')}>
        <button type="button" className={view === 'cellar' ? 'active' : ''} onClick={() => setView('cellar')} aria-pressed={view === 'cellar'}>
          {t('cellarView')}
        </button>
        <button type="button" className={view === 'slots' ? 'active' : ''} onClick={() => setView('slots')} aria-pressed={view === 'slots'}>
          {t('slotView')}
        </button>
      </div>
      <div className={view === 'cellar' ? 'cellar-card' : 'card'}>
        {racks.length === 0
          ? <p className="muted">{t('empty')}</p>
          : <SlotPicker key={key} value={null} readOnly visual={view === 'cellar'} onTapOccupied={(id) => nav(`/bottles?open=${id}`)} />}
      </div>
      {editing && <RackForm rack={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />}
    </div>
  )
}

function RackForm({ rack, onClose, onSaved }: { rack: Partial<Rack>; onClose: () => void; onSaved: () => void }) {
  const { t } = useT()
  const [f, setF] = useState<Partial<Rack>>({ ...rack })
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false)
  const isNew = !rack.id

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null)
    const payload = { name: f.name, description: f.description || null, shelves: Number(f.shelves), positions_per_shelf: Number(f.positions_per_shelf) }
    const { error } = isNew ? await supabase.from('racks').insert(payload) : await supabase.from('racks').update(payload).eq('id', rack.id!)
    setBusy(false); if (error) setErr(error.message); else onSaved()
  }
  const remove = async () => {
    if (!confirm(t('confirmDelete'))) return
    const { error } = await supabase.from('racks').delete().eq('id', rack.id!)
    if (error) setErr(error.message); else onSaved()
  }

  return (
    <Sheet title={isNew ? t('newRack') : t('edit')} onClose={onClose}>
      <form className="stack" onSubmit={save}>
        <Field label={t('name')}><input required value={f.name ?? ''} onChange={(e) => setF({ ...f, name: e.target.value })} placeholder="A" /></Field>
        <div className="grid2">
          <Field label={t('shelves')}><input type="number" min={1} max={50} required value={f.shelves ?? ''} onChange={(e) => setF({ ...f, shelves: Number(e.target.value) })} /></Field>
          <Field label={t('positionsPerShelf')}><input type="number" min={1} max={60} required value={f.positions_per_shelf ?? ''} onChange={(e) => setF({ ...f, positions_per_shelf: Number(e.target.value) })} /></Field>
        </div>
        <Field label={t('description')}><input value={f.description ?? ''} onChange={(e) => setF({ ...f, description: e.target.value })} /></Field>
        {err && <div className="error">{err}</div>}
        <div className="actions">
          {!isNew && <button type="button" className="btn danger" onClick={remove}>{t('delete')}</button>}
          <button type="button" className="btn secondary" onClick={onClose}>{t('cancel')}</button>
          <button className="btn" disabled={busy}>{t('save')}</button>
        </div>
      </form>
    </Sheet>
  )
}
