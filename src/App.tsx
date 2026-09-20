import { BrowserRouter, NavLink, Navigate, Route, Routes } from 'react-router-dom'
import { useEffect, useState } from 'react'
import { AuthProvider, useAuth } from './lib/auth'
import { I18nProvider, useT } from './lib/i18n'
import { supabase } from './lib/supabase'
import { Login } from './pages/Login'
import { Dashboard } from './pages/Dashboard'
import { Bottles } from './pages/Bottles'
import { Wines } from './pages/Wines'
import { Racks } from './pages/Racks'
import { Clients } from './pages/Clients'
import { Sales } from './pages/Sales'
import { Admin } from './pages/Admin'
import { Loading } from './components/ui'

const Icon = ({ d }: { d: string }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
const icons = {
  home: 'M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-4v-6H9v6H5a2 2 0 0 1-2-2z',
  bottle: 'M3 9h16a2 2 0 0 1 2 2v2a2 2 0 0 1-2 2H3z M5 9V7h12v2 M5 15v2h12v-2',
  wine: 'M4 7h16v10H4z M7 10h10M7 13h7',
  rack: 'M3 5h18M3 12h18M3 19h18M6 5v14M12 5v14M18 5v14',
  people: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  sale: 'M3 5h18v14H3zM7 9h10M7 13h5',
  admin: 'M12 3l2 3 4 .5-2 3 .5 4-4.5-1.5L7.5 13 8 9.5l-2-3L10 6z',
}

function Shell() {
  const { t, lang, setLang } = useT()
  const { session, profile, loading } = useAuth()
  const [showInstall, setShowInstall] = useState(false)

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone
    const ios = /iphone|ipad/i.test(navigator.userAgent)
    let dismissed = false; try { dismissed = localStorage.getItem('installHint') === '1' } catch {}
    setShowInstall(ios && !standalone && !dismissed)
  }, [])

  if (loading) return <div className="auth"><Loading /></div>
  if (!session) return <Login />

  const tabs = [
    { to: '/', label: t('dashboard'), icon: icons.home },
    { to: '/bottles', label: t('bottles'), icon: icons.bottle },
    { to: '/wines', label: t('wines'), icon: icons.wine },
    { to: '/racks', label: t('racks'), icon: icons.rack },
    { to: '/clients', label: t('clients'), icon: icons.people },
    { to: '/sales', label: 'Ventas', icon: icons.sale },
    ...(profile?.role === 'admin' ? [{ to: '/admin', label: 'Admin', icon: icons.admin }] : []),
  ]

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand"><img src="/icon.svg" alt="" />{t('appName')}</div>
        <div className="actions">
          <select value={lang} onChange={(e) => setLang(e.target.value as any)} aria-label={t('language')}>
            <option value="es">ES</option><option value="en">EN</option>
          </select>
          <button onClick={() => supabase.auth.signOut()}>{t('signOut')}</button>
        </div>
      </header>
      <main className="main">
        {showInstall && <div className="info row between" style={{ marginBottom: 12 }}>
          <span>{t('installHint')}</span>
          <button className="btn sm secondary" onClick={() => { setShowInstall(false); try { localStorage.setItem('installHint', '1') } catch {} }}>✕</button>
        </div>}
        <Routes>
          <Route path="/" element={<Dashboard />} />
          <Route path="/bottles" element={<Bottles />} />
          <Route path="/wines" element={<Wines />} />
          <Route path="/racks" element={<Racks />} />
          <Route path="/clients" element={<Clients />} />
          <Route path="/sales" element={<Sales />} />
          <Route path="/admin" element={<Admin />} />
          <Route path="*" element={<Navigate to="/" replace />} />
        </Routes>
      </main>
      <nav className="tabbar">
        {tabs.map((tb) => <NavLink key={tb.to} to={tb.to} end={tb.to === '/'} className={({ isActive }) => (isActive ? 'active' : '')}><Icon d={tb.icon} />{tb.label}</NavLink>)}
      </nav>
    </div>
  )
}

export default function App() {
  return (
    <I18nProvider>
      <AuthProvider>
        <BrowserRouter><Shell /></BrowserRouter>
      </AuthProvider>
    </I18nProvider>
  )
}
