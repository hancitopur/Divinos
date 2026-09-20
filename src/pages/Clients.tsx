import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { money, useT } from '../lib/i18n'
import type { Client, ClientValue } from '../lib/types'
import { Empty, Field, Loading, Sheet } from '../components/ui'

export function Clients() {
  const { t, lang } = useT()
  const [rows, setRows] = useState<Client[] | null>(null)
  const [vals, setVals] = useState<Record<string, ClientValue>>({})
  const [editing, setEditing] = useState<Partial<Client> | null>(null)

  const load = async () => {
    const [{ data }, { data: v }] = await Promise.all([supabase.from('clients').select('*').order('name'), supabase.from('client_values').select('*')])
    setRows((data ?? []) as Client[])
    const m: Record<string, ClientValue> = {}; for (const r of (v ?? []) as ClientValue[]) m[r.client_id] = r; setVals(m)
  }
  useEffect(() => { load() }, [])

  return (
    <div className="stack">
      <h1>{t('clients')}</h1>
      {rows === null ? <Loading /> : rows.length === 0 ? <Empty /> : (
        <div className="list">
          {rows.map((c) => {
            const v = vals[c.id]
            return (
              <div className="item" key={c.id} onClick={() => setEditing(c)}>
                <div className="thumb" style={{ width: 44, height: 44, borderRadius: 22, fontSize: 18 }}>{c.name.slice(0, 1).toUpperCase()}</div>
                <div className="body">
                  <div className="title">{c.name} {!c.active && <span className="badge">{t('inactive')}</span>}</div>
                  <div className="meta">{[c.phone, c.email].filter(Boolean).join(' · ')}</div>
                </div>
                <div style={{ textAlign: 'right' }} onClick={(e) => e.stopPropagation()}>
                  <Link to={`/bottles?client=${c.id}`} className="bold">{v?.bottles_in_storage ?? 0} botellas</Link>
                  <div className="muted small">{money(v?.sale_value ?? 0, lang)}</div>
                </div>
              </div>
            )
          })}
        </div>
      )}
      <button className="fab" aria-label={t('newClient')} onClick={() => setEditing({ active: true })}>+</button>
      {editing && <ClientForm client={editing} onClose={() => setEditing(null)} onSaved={() => { setEditing(null); load() }} />}
    </div>
  )
}

function ClientForm({ client, onClose, onSaved }: { client: Partial<Client>; onClose: () => void; onSaved: () => void }) {
  const { t } = useT()
  const [f, setF] = useState<Partial<Client>>({ ...client })
  const [err, setErr] = useState<string | null>(null); const [busy, setBusy] = useState(false)
  const isNew = !client.id

  const save = async (e: React.FormEvent) => {
    e.preventDefault(); setBusy(true); setErr(null)
    const payload = { name: f.name, email: f.email || null, phone: f.phone || null, notes: f.notes || null, active: f.active ?? true }
    const { error } = isNew ? await supabase.from('clients').insert(payload) : await supabase.from('clients').update(payload).eq('id', client.id!)
    setBusy(false); if (error) setErr(error.message); else onSaved()
  }

  return (
    <Sheet title={isNew ? t('newClient') : t('edit')} onClose={onClose}>
      <form className="stack" onSubmit={save}>
        <Field label={t('name')}><input required value={f.name ?? ''} onChange={(e) => setF({ ...f, name: e.target.value })} /></Field>
        <div className="grid2">
          <Field label={t('phone')}><input type="tel" value={f.phone ?? ''} onChange={(e) => setF({ ...f, phone: e.target.value })} /></Field>
          <Field label={t('email')}><input type="email" value={f.email ?? ''} onChange={(e) => setF({ ...f, email: e.target.value })} /></Field>
        </div>
        <Field label={t('notes')}><textarea rows={2} value={f.notes ?? ''} onChange={(e) => setF({ ...f, notes: e.target.value })} /></Field>
        <label className="row"><input type="checkbox" checked={f.active ?? true} onChange={(e) => setF({ ...f, active: e.target.checked })} /> {t('active')}</label>
        {err && <div className="error">{err}</div>}
        <div className="actions">
          <button type="button" className="btn secondary" onClick={onClose}>{t('cancel')}</button>
          <button className="btn" disabled={busy}>{t('save')}</button>
        </div>
      </form>
    </Sheet>
  )
}
