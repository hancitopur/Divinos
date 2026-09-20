import { useEffect, useState, type ReactNode } from 'react'
import { useT } from '../lib/i18n'
import { labelUrl, uploadLabel } from '../lib/supabase'
import { wineProductPhoto } from '../lib/productPhotos'

export function Sheet({ title, onClose, children }: { title: string; onClose: () => void; children: ReactNode }) {
  useEffect(() => {
    const previous = document.body.style.overflow
    document.body.style.overflow = 'hidden'
    const closeOnEscape = (event: KeyboardEvent) => { if (event.key === 'Escape') onClose() }
    window.addEventListener('keydown', closeOnEscape)
    return () => { document.body.style.overflow = previous; window.removeEventListener('keydown', closeOnEscape) }
  }, [onClose])
  return (
    <div className="sheet-backdrop" onClick={onClose}>
      <div className="sheet" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <div className="sheet-head"><h2>{title}</h2><button type="button" className="sheet-close" aria-label="Cerrar" onClick={onClose}>×</button></div>
        {children}
      </div>
    </div>
  )
}

export function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="field"><label>{label}</label>{children}</div>
}

export function Thumb({ path, className = '', label = '' }: { path: string | null | undefined; className?: string; label?: string }) {
  const [url, setUrl] = useState<string | null>(null)
  useEffect(() => {
    let active = true
    labelUrl(path, className.includes('lg') ? 1000 : 200).then((next) => { if (active) setUrl(next) })
    return () => { active = false }
  }, [path, className])
  return url
    ? <img className={`thumb ${className}`} src={url} alt="" loading="lazy" />
    : label
      ? <img className={`thumb photo-fallback ${className}`} src={wineProductPhoto(label)} alt={`Botella de ${label}`} loading="lazy" />
      : <img className={`thumb photo-fallback ${className}`} src={wineProductPhoto()} alt="Botella de vino" loading="lazy" />
}

/** Camera/upload button. Uploads immediately and calls onUploaded(path). */
export function PhotoPicker({ path, prefix, onUploaded }: { path: string | null | undefined; prefix: string; onUploaded: (p: string) => void }) {
  const { t } = useT()
  const [busy, setBusy] = useState(false)
  const [err, setErr] = useState<string | null>(null)
  return (
    <div className="stack">
      {path && <Thumb path={path} className="lg" />}
      <label className="photo-btn">
        <input type="file" accept="image/*" capture="environment" disabled={busy}
          onChange={async (e) => {
            const f = e.target.files?.[0]; if (!f) return
            setBusy(true); setErr(null)
            try { onUploaded(await uploadLabel(f, prefix)) } catch (ex: any) { setErr(ex.message) } finally { setBusy(false) }
          }} />
        📷 {busy ? t('loading') : path ? t('changePhoto') : t('takePhoto')}
      </label>
      {err && <div className="error">{err}</div>}
    </div>
  )
}

export function StatusBadge({ status }: { status: string }) {
  const { t } = useT()
  return <span className={`badge ${status}`}>{t(`status_${status}` as any)}</span>
}

export function Empty() { const { t } = useT(); return <p className="muted" style={{ textAlign: 'center', padding: 30 }}>{t('empty')}</p> }
export function Loading() { const { t } = useT(); return <p className="muted" style={{ textAlign: 'center', padding: 30 }}>{t('loading')}</p> }

export function Loc({ rack, shelf, position }: { rack: string | null; shelf: number | null; position: number | null }) {
  const { t } = useT()
  if (!rack) return <span className="muted small">{t('noLocation')}</span>
  return <span className="loc">{rack} · S{shelf} · P{position}</span>
}
