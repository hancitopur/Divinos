import { HashRouter, NavLink, Navigate, Route, Routes, useLocation } from 'react-router-dom'
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
import { Demo } from './pages/Demo'
import { Landing } from './pages/Landing'
import { Terms } from './pages/Terms'
import { ResetPassword } from './pages/ResetPassword'
import { AccountPending } from './pages/AccountPending'
import { AdminAccounts, AdminIntakes, AdminWineSales, ClientAccount, ClientCollection, ClientIntake, ClientOverview, ClientSell, ClientShop } from './pages/ClientPortal'
import { Brand } from './components/Brand'
import { Loading } from './components/ui'

const Icon = ({ d }: { d: string }) => <svg viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round"><path d={d} /></svg>
const icons = {
  home: 'M3 11l9-8 9 8v9a2 2 0 0 1-2 2h-4v-6H9v6H5a2 2 0 0 1-2-2z',
  bottle: 'M10 2h4v5l3 4v9a2 2 0 0 1-2 2H9a2 2 0 0 1-2-2v-9l3-4z M7 14h10',
  wine: 'M8 3h8l-1 7a3 3 0 0 1-6 0zM12 13v6M8 21h8',
  rack: 'M3 5h18M3 12h18M3 19h18M6 5v14M12 5v14M18 5v14',
  people: 'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2M9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM22 21v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8',
  plus: 'M12 5v14M5 12h14',
  account: 'M12 12a4 4 0 1 0 0-8 4 4 0 0 0 0 8zM4 21a8 8 0 0 1 16 0',
  shop: 'M4 8h16l-1 13H5zM8 8a4 4 0 0 1 8 0',
  inbox: 'M4 4h16v14H4zM4 14h5l2 2h2l2-2h5',
}

function ClientShell() {
  const { lang, setLang, t } = useT()
  const tabs = [
    { to: '/', label: 'Mi cava', icon: icons.home },
    { to: '/collection', label: 'Colección', icon: icons.bottle },
    { to: '/shop', label: 'Comprar', icon: icons.shop },
    { to: '/intake', label: 'Solicitar', icon: icons.plus },
    { to: '/account', label: 'Cuenta', icon: icons.account },
  ]
  return <div className="app client-app"><header className="topbar"><div className="brand"><Brand light /></div><div className="actions"><select value={lang} onChange={(e)=>setLang(e.target.value as any)} aria-label={t('language')}><option value="es">ES</option><option value="en">EN</option></select></div></header><main className="main client-main"><Routes><Route path="/" element={<ClientOverview/>}/><Route path="/collection" element={<ClientCollection/>}/><Route path="/shop" element={<ClientShop/>}/><Route path="/sell" element={<ClientSell/>}/><Route path="/intake" element={<ClientIntake/>}/><Route path="/account" element={<ClientAccount/>}/><Route path="*" element={<Navigate to="/" replace/>}/></Routes></main><nav className="tabbar client-tabbar">{tabs.map((tb)=><NavLink key={tb.to} to={tb.to} end={tb.to==='/' } className={({isActive})=>isActive?'active':''}><Icon d={tb.icon}/>{tb.label}</NavLink>)}</nav></div>
}

function Shell() {
  const { t, lang, setLang } = useT()
  const { session, profile, membership, loading } = useAuth()
  const location = useLocation()
  const [showInstall, setShowInstall] = useState(false)

  useEffect(() => {
    const standalone = window.matchMedia('(display-mode: standalone)').matches || (navigator as any).standalone
    const ios = /iphone|ipad/i.test(navigator.userAgent)
    let dismissed = false; try { dismissed = localStorage.getItem('installHint') === '1' } catch {}
    setShowInstall(ios && !standalone && !dismissed)
  }, [])

  if (location.pathname === '/sales') return <Landing />
  if (location.pathname === '/demo') return <Demo />
  if (location.pathname === '/terms') return <Terms />
  if (location.pathname === '/reset-password') return <ResetPassword />
  if (loading) return <div className="auth"><Loading /></div>
  if (!session) return (
    <Routes>
      <Route path="/demo" element={<Demo />} />
      <Route path="/sales" element={<Landing />} />
      <Route path="/login" element={<Login />} />
      <Route path="/reset-password" element={<ResetPassword />} />
      <Route path="/terms" element={<Terms />} />
      <Route path="/" element={<Landing />} />
      <Route path="*" element={<Navigate to="/" replace />} />
    </Routes>
  )

  const paidMember = profile?.role === 'member' && membership?.status === 'active'
  if (paidMember) return <ClientShell />
  if (!profile || profile.role === 'pending' || profile.role === 'member') return <AccountPending membership={membership} />

  const tabs = [
    { to: '/', label: t('dashboard'), icon: icons.home },
    { to: '/bottles', label: t('bottles'), icon: icons.bottle },
    { to: '/wines', label: t('wines'), icon: icons.wine },
    { to: '/racks', label: t('racks'), icon: icons.rack },
    { to: '/clients', label: t('clients'), icon: icons.people },
    { to: '/intakes', label: 'Entradas', icon: icons.inbox },
  ]

  return (
    <div className="app">
      <header className="topbar">
        <div className="brand"><Brand light /></div>
        <div className="actions">
          <select value={lang} onChange={(e) => setLang(e.target.value as any)} aria-label={t('language')}>
            <option value="es">ES</option><option value="en">EN</option>
          </select>
          <button aria-label={t('signOut')} title={t('signOut')} onClick={() => supabase.auth.signOut()}>{lang === 'es' ? 'Salir' : 'Exit'}</button>
          {profile?.role === 'superadmin' && <NavLink className="admin-link" to="/admin/accounts" aria-label="Cuentas">⚙</NavLink>}
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
          <Route path="/intakes" element={<AdminIntakes />} />
          <Route path="/shop" element={<ClientShop />} />
          <Route path="/sales-inventory" element={<AdminWineSales />} />
          <Route path="/admin/accounts" element={profile?.role === 'superadmin' ? <AdminAccounts /> : <Navigate to="/" replace />} />
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
        <HashRouter><Shell /></HashRouter>
      </AuthProvider>
    </I18nProvider>
  )
}
