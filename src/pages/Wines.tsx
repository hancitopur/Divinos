import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useT } from '../lib/i18n'
import type { Wine, WineType } from '../lib/types'
import { Empty, Field, Loading, PhotoPicker, Sheet, Thumb } from '../components/ui'
import { importWineImage, searchWineImages, type WineImageResult } from '../lib/wineImages'

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
              <Thumb path={w.label_photo_path} label={`${w.name} ${w.vintage ?? ''}`} />
              <div className="body">
                <div className="title">{w.name}{w.vintage ? ` ${w.vintage}` : ''}</div>
                <div className="meta">{[w.producer, w.region, w.type ? t(`type_${w.type}` as any) : null].filter(Boolean).join(' · ')}</div>
              </div>
              <div className="bold">{counts[w.id] ?? 0} <span className="muted small">{t('bottleCount')}</span></div>
            </div>
          ))}
        </div>
      )}
      <button className="fab" aria-label={t('newWine')} onClick={() => setEditing({ size_ml: 750, type: 'red' })}>+</button>
      {editing && <WineForm wine={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />}
    </div>
  )
}

function WineForm({ wine, onClose, onSaved }: { wine: Partial<Wine>; onClose: () => void; onSaved: () => void }) {
  const { t, lang } = useT()
  const [f, setF] = useState<Partial<Wine>>({ ...wine })
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false)
  const [imageQuery, setImageQuery] = useState([wine.producer, wine.name, wine.vintage].filter(Boolean).join(' '))
  const [imageResults, setImageResults] = useState<WineImageResult[]>([])
  const [imageBusy, setImageBusy] = useState(false)
  const [autofilled, setAutofilled] = useState<string[]>([])
  const set = (k: keyof Wine, v: any) => setF((p) => ({ ...p, [k]: v }))
  const isNew = !wine.id

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null)
    const payload = {
      name: f.name, producer: f.producer || null, vintage: f.vintage ? Number(f.vintage) : null, region: f.region || null,
      country: f.country || null, varietal: f.varietal || null, type: f.type || null, size_ml: Number(f.size_ml || 750),
      label_photo_path: f.label_photo_path ?? null, notes: f.notes || null, barcode: f.barcode || null,
      label_source: f.label_source || null, label_source_url: f.label_source_url || null,
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
        <Field label={t('labelPhoto')}>
          <PhotoPicker path={f.label_photo_path} prefix="wines" onUploaded={(p) => {
            setF((prev) => ({ ...prev, label_photo_path: p, label_source: 'camera_upload', label_source_url: null }))
          }} />
        </Field>
        <div className="label-search card stack">
          <div>
            <strong>{lang === 'es' ? 'Buscar etiqueta por nombre' : 'Find label by name'}</strong>
            <div className="muted small">{lang === 'es' ? 'Busca, confirma la etiqueta y Divinos completará los datos disponibles.' : 'Search, confirm the label, and Divinos will fill the available details.'}</div>
          </div>
          <div className="row">
            <input className="search" value={imageQuery} onChange={(e) => setImageQuery(e.target.value)} placeholder="Marca, vino y añada" />
            <button type="button" className="btn" disabled={imageBusy || imageQuery.trim().length < 3} onClick={async () => {
              setImageBusy(true); setErr(null)
              try { setImageResults(await searchWineImages(imageQuery)) } catch (ex: any) { setErr(ex.message) } finally { setImageBusy(false) }
            }}>{imageBusy ? '…' : lang === 'es' ? 'Buscar' : 'Search'}</button>
          </div>
          {imageResults.length > 0 && <div className="label-results">
            {imageResults.map((result) => <button type="button" className="label-result" key={result.id} onClick={async () => {
              setImageBusy(true); setErr(null)
              try {
                const path = await importWineImage(result)
                const values: Array<[keyof Wine, unknown, string]> = [
                  ['name', result.name, lang === 'es' ? 'nombre' : 'name'],
                  ['producer', result.producer, lang === 'es' ? 'productor' : 'producer'],
                  ['vintage', result.vintage, lang === 'es' ? 'añada' : 'vintage'],
                  ['region', result.region, lang === 'es' ? 'región' : 'region'],
                  ['country', result.country, lang === 'es' ? 'país' : 'country'],
                  ['varietal', result.varietal, lang === 'es' ? 'varietal' : 'varietal'],
                  ['type', result.type, lang === 'es' ? 'tipo' : 'type'],
                  ['size_ml', result.sizeMl, lang === 'es' ? 'tamaño' : 'size'],
                  ['barcode', result.barcode, 'UPC / EAN'],
                ]
                setF((prev) => {
                  const next = { ...prev, label_photo_path: path, label_source: result.source, label_source_url: result.sourceUrl }
                  for (const [key, value] of values) if (value !== undefined && value !== null && value !== '') (next as any)[key] = value
                  return next
                })
                setAutofilled(values.filter(([, value]) => value !== undefined && value !== null && value !== '').map(([, , label]) => label))
                setImageResults([])
              } catch (ex: any) { setErr(ex.message) } finally { setImageBusy(false) }
            }}>
              <img src={result.thumbnailUrl} alt="" loading="lazy" referrerPolicy="no-referrer" />
              <span><b>{result.title}</b><small>{result.subtitle}</small></span>
            </button>)}
          </div>}
          {autofilled.length > 0 && <div className="autofill-note">✓ {lang === 'es' ? 'Completado automáticamente:' : 'Filled automatically:'} {autofilled.join(', ')}. {lang === 'es' ? 'Puedes corregir cualquier campo antes de guardar.' : 'You can edit any field before saving.'}</div>}
          {f.label_source && <div className="muted small">
            {f.label_source === 'camera_upload' ? (lang === 'es' ? 'Fuente: foto propia' : 'Source: own photo') : <>{lang === 'es' ? 'Fuente: ' : 'Source: '}<a className="source-link" href={f.label_source_url || '#'} target="_blank" rel="noreferrer">{f.label_source === 'open_food_facts' ? 'Open Food Facts' : 'Wikimedia Commons'}</a></>}
          </div>}
        </div>
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
          <Field label="UPC / EAN"><input inputMode="numeric" value={f.barcode ?? ''} onChange={(e) => set('barcode', e.target.value.replace(/\D/g, ''))} /></Field>
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
