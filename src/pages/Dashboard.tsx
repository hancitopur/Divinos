import { useEffect, useState } from 'react'
import { Link } from 'react-router-dom'
import { supabase } from '../lib/supabase'
import { money, useT } from '../lib/i18n'
import type { ClientValue, StorageSummary } from '../lib/types'
import { Loading } from '../components/ui'

export function Dashboard() {
  const { t, lang } = useT()
  const [sum, setSum] = useState<StorageSummary | null>(null)
  const [clients, setClients] = useState<ClientValue[]>([])

  useEffect(() => {
    supabase.from('storage_summary').select('*').single().then(({ data }) => setSum(data as StorageSummary))
    supabase.from('client_values').select('*').order('sale_value', { ascending: false }).then(({ data }) => setClients((data ?? []) as ClientValue[]))
  }, [])

  if (!sum) return <Loading />
  const margin = Number(sum.sale_value) - Number(sum.purchase_value)
  const pct = sum.total_slots ? Math.round((sum.used_slots / sum.total_slots) * 100) : 0

  return (
    <div className="stack">
      <h1>{t('dashboard')}</h1>
      <div className="grid4">
        <div className="stat"><div className="label">{t('inStorage')}</div><div className="value">{sum.bottles_in_storage}</div><div className="sub">{t('bottleCount')}</div></div>
        <div className="stat"><div className="label">{t('purchaseValue')}</div><div className="value">{money(sum.purchase_value, lang)}</div></div>
        <div className="stat"><div className="label">{t('saleValue')}</div><div className="value">{money(sum.sale_value, lang)}</div></div>
        <div className="stat"><div className="label">{t('margin')}</div><div className={`value ${margin >= 0 ? 'ok' : 'bad'}`}>{money(margin, lang)}</div></div>
      </div>
      <div className="card">
        <div className="row between"><h3>{t('occupancy')}</h3><span className="muted small">{sum.used_slots}/{sum.total_slots} {t('slots')} · {pct}%</span></div>
        <div style={{ height: 10, background: 'var(--cream)', borderRadius: 6, marginTop: 8, overflow: 'hidden' }}>
          <div style={{ width: `${pct}%`, height: '100%', background: pct > 90 ? 'var(--bad)' : 'var(--wine)' }} />
        </div>
      </div>
      <div className="card">
        <h3 style={{ marginBottom: 8 }}>{t('valueByClient')}</h3>
        <table className="table">
          <thead><tr><th>{t('client')}</th><th className="num">#</th><th className="num">{t('purchaseValue')}</th><th className="num">{t('saleValue')}</th></tr></thead>
          <tbody>
            {clients.filter((c) => c.bottles_in_storage > 0).map((c) => (
              <tr key={c.client_id}>
                <td><Link to={`/bottles?client=${c.client_id}`} className="bold">{c.client_name}</Link></td>
                <td className="num">{c.bottles_in_storage}</td>
                <td className="num">{money(c.purchase_value, lang)}</td>
                <td className="num">{money(c.sale_value, lang)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  )
}
