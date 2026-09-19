import { useEffect, useMemo, useState } from 'react'
import { supabase } from '../lib/supabase'
import { useT } from '../lib/i18n'
import { Field } from './ui'
import type { Rack, Slot } from '../lib/types'

/**
 * Visual rack map. Occupied slots are wine-colored; the current bottle's slot is outlined in gold.
 * onPick(slotId) fires when the user taps a free slot (or the current one).
 */
export function SlotPicker({ value, currentBottleId, onPick, readOnly, onTapOccupied }: {
  value: string | null; currentBottleId?: string; onPick?: (slotId: string | null) => void
  readOnly?: boolean; onTapOccupied?: (bottleId: string) => void
}) {
  const { t } = useT()
  const [racks, setRacks] = useState<Rack[]>([])
  const [rackId, setRackId] = useState<string>('')
  const [slots, setSlots] = useState<Slot[]>([])
  const [occ, setOcc] = useState<Record<string, { bottleId: string; label: string }>>({})

  useEffect(() => {
    supabase.from('racks').select('*').order('name').then(({ data }) => {
      const rs = (data ?? []) as Rack[]; setRacks(rs)
      if (!rackId && rs.length) setRackId(rs[0].id)
    })
  }, [])

  // If a value is set, jump to its rack
  useEffect(() => {
    if (!value) return
    supabase.from('slots').select('rack_id').eq('id', value).maybeSingle().then(({ data }) => { if (data) setRackId(data.rack_id) })
  }, [value])

  useEffect(() => {
    if (!rackId) return
    Promise.all([
      supabase.from('slots').select('*').eq('rack_id', rackId).order('shelf').order('position'),
      supabase.from('bottle_details').select('id, slot_id, wine_name, vintage, client_name').eq('rack_id', rackId).eq('status', 'in_storage'),
    ]).then(([s, b]) => {
      setSlots((s.data ?? []) as Slot[])
      const m: Record<string, { bottleId: string; label: string }> = {}
      for (const row of b.data ?? []) if (row.slot_id) m[row.slot_id] = { bottleId: row.id, label: `${row.wine_name}${row.vintage ? ' ' + row.vintage : ''} — ${row.client_name}` }
      setOcc(m)
    })
  }, [rackId])

  const byShelf = useMemo(() => {
    const m = new Map<number, Slot[]>()
    for (const s of slots) { if (!m.has(s.shelf)) m.set(s.shelf, []); m.get(s.shelf)!.push(s) }
    return [...m.entries()].sort((a, b) => a[0] - b[0])
  }, [slots])

  const used = Object.keys(occ).length

  return (
    <div className="stack">
      <Field label={t('rack')}>
        <select value={rackId} onChange={(e) => setRackId(e.target.value)}>
          {racks.length === 0 && <option value="">{t('chooseRack')}</option>}
          {racks.map((r) => <option key={r.id} value={r.id}>{r.name}</option>)}
        </select>
      </Field>
      {rackId && (
        <>
          <div className="small muted">{used}/{slots.length} {t('occupied')} · {readOnly ? t('legend') : t('selectSlot')}</div>
          <div className="rackmap">
            {byShelf.map(([shelf, ss]) => (
              <div className="shelfrow" key={shelf}>
                <div className="shelflabel">S{shelf}</div>
                <div className="slots">
                  {ss.map((s) => {
                    const o = occ[s.id]
                    const mine = o && o.bottleId === currentBottleId
                    const full = !!o && !mine
                    const sel = value === s.id
                    return (
                      <button type="button" key={s.id} title={o?.label ?? `${t('position')} ${s.position} · ${t('free')}`}
                        className={`slot ${full ? 'full' : ''} ${mine ? 'mine' : ''} ${sel ? 'sel' : ''}`}
                        onClick={() => {
                          if (o && !mine) { onTapOccupied?.(o.bottleId); return }
                          if (readOnly) return
                          onPick?.(sel ? null : s.id)
                        }}>
                        {s.position}
                      </button>
                    )
                  })}
                </div>
              </div>
            ))}
          </div>
        </>
      )}
    </div>
  )
}
