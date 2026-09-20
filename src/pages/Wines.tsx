import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useT } from '../lib/i18n'
import type { Wine, WineType } from '../lib/types'
import { Empty, Field, Loading, PhotoPicker, Sheet, Thumb } from '../components/ui'

const TYPES: WineType[] = ['red', 'white', 'rose', 'sparkling', 'dessert', 'fortified', 'other']

export function Wines() {
  const { t } = useT()
  const [rows, setRows] = useState<Wine[] | null>(null)
  const [counts, setCounts] = useState<Record<string, number>>({})
  const [q, setQ] = useState('')
  const [editing, setEditing] = useState<Partial<Wine> | null>(null)

  const load = async () => {
    const [{ data }, { data: b }] = await Promise.all([
      supabase.from('wines').select('*').order('name'),
      supabase.from('bottles').select('wine_id').eq('status', 'in_storage'),
    ])
    setRows((data ?? []) as Wine[])
    const c: Record<string, number> = {}; for (const r of b ?? []) c[r.wine_id] = (c[r.wine_id] ?? 0) + 1; setCounts(c)
  }
  useEffect(() => { load() }, [])

  const list = useMemo(() => {
    const s = q.trim().toLowerCase()
    return (rows ?? []).filter((w) => !s || [w.name, w.producer, w.region, w.varietal, String(w.vintage ?? '')].join(' ').toLowerCase().includes(s))
  }, [rows, q])

  return (
    <div className="stack">
      <h1>{t('wines')}</h1>
      <input className="search" placeholder={t('search')} value={q} onChange={(e) => setQ(e.target.value)} />
      {rows === null ? <Loading /> : list.length === 0 ? <Empty /> : (
        <div className="list">
          {list.map((w) => (
            <div className="item" key={w.id} onClick={() => setEditing(w)}>
              <Thumb path={w.label_photo_path} />
              <div className="body">
                <div className="title">{w.name}{w.vintage ? ` ${w.vintage}` : ''}</div>
                <div className="meta">{[w.producer, w.region, w.type ? t(`type_${w.type}` as any) : null].filter(Boolean).join(' · ')}</div>
              </div>
              <div className="bold">{counts[w.id] ?? 0} <span className="muted small">{t('bottleCount')}</span></div>
            </div>
          ))}
        </div>
      )}
      <button className="fab" onClick={() => setEditing({ size_ml: 750, type: 'red' })}>+</button>
      {editing && <WineForm wine={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />}
    </div>
  )
}

function WineForm({ wine, onClose, onSaved }: { wine: Partial<Wine>; onClose: () => void; onSaved: () => void }) {
  const { t } = useT()
  const [f, setF] = useState<Partial<Wine>>({ ...wine })
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false)
  const set = (k: keyof Wine, v: any) => setF((p) => ({ ...p, [k]: v }))
  const isNew = !wine.id

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null)
    const payload = {
      name: f.name, producer: f.producer || null, vintage: f.vintage ? Number(f.vintage) : null, region: f.region || null,
      country: f.country || null, varietal: f.varietal || null, type: f.type || null, size_ml: Number(f.size_ml || 750),
      label_photo_path: f.label_photo_path ?? null, notes: f.notes || null,
    }
    const { error } = isNew ? await supabase.from('wines').insert(payload) : await supabase.from('wines').update(payload).eq('id', wine.id!)
    setBusy(false); if (error) setErr(error.message); else onSaved()
  }
  const remove = async () => {
    if (!confirm(t('confirmDelete'))) return
    const { error } = await supabase.from('wines').delete().eq('id', wine.id!)
    if (error) setErr(error.message); else onSaved()
  }

  return (
    <Sheet title={isNew ? t('newWine') : t('edit')} onClose={onClose}>
      <form className="stack" onSubmit={save}>
        <Field label={t('labelPhoto')}><PhotoPicker path={f.label_photo_path} prefix="wines" onUploaded={(p) => set('label_photo_path', p)} /></Field>
        <Field label={t('name')}><input required value={f.name ?? ''} onChange={(e) => set('name', e.target.value)} /></Field>
        <div className="grid2">
          <Field label={t('producer')}><input value={f.producer ?? ''} onChange={(e) => set('producer', e.target.value)} /></Field>
          <Field label={t('vintage')}><input type="number" inputMode="numeric" min={1800} max={2100} value={f.vintage ?? ''} onChange={(e) => set('vintage', e.target.value)} /></Field>
          <Field label={t('type')}>
            <select value={f.type ?? 'red'} onChange={(e) => set('type', e.target.value)}>{TYPES.map((x) => <option key={x} value={x}>{t(`type_${x}` as any)}</option>)}</select>
          </Field>
          <Field label={t('size')}><input type="number" inputMode="numeric" value={f.size_ml ?? 750} onChange={(e) => set('size_ml', e.target.value)} /></Field>
          <Field label={t('varietal')}><input value={f.varietal ?? ''} onChange={(e) => set('varietal', e.target.value)} /></Field>
          <Field label={t('region')}><input value={f.region ?? ''} onChange={(e) => set('region', e.target.value)} /></Field>
          <Field label={t('country')}><input value={f.country ?? ''} onChange={(e) => set('country', e.target.value)} /></Field>
        </div>
        <Field label={t('notes')}><textarea rows={2} value={f.notes ?? ''} onChange={(e) => set('notes', e.target.value)} /></Field>
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
