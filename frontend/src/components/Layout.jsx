import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { Home, Receipt, Target, User, Plus, Sun, Moon } from 'lucide-react'
import { useAuth } from '../context/AuthContext.jsx'
import { useTheme } from '../context/ThemeContext.jsx'
import AddTransactionModal from './AddTransactionModal.jsx'

const NAV = [
  { to: '/', label: 'Início', Icon: Home },
  { to: '/transactions', label: 'Extrato', Icon: Receipt },
  { to: '/goals', label: 'Metas', Icon: Target },
  { to: '/settings', label: 'Perfil', Icon: User },
]

const TITLES = {
  '/': null,
  '/transactions': 'Extrato',
  '/goals': 'Minhas Metas',
  '/gastos-fixos': 'Gastos Fixos',
  '/settings': 'Perfil',
}

export default function Layout() {
  const { user } = useAuth()
  const { theme, toggleTheme } = useTheme()
  const location = useLocation()
  const [showAdd, setShowAdd] = useState(false)
  // Incremented after adding a transaction so child pages refetch.
  const [refreshKey, setRefreshKey] = useState(0)

  const pageTitle = TITLES[location.pathname]

  return (
    <div className="app-shell">
      <header className="topbar">
        {pageTitle ? (
          <h1>{pageTitle}</h1>
        ) : (
          <div>
            <div className="greeting">Olá,</div>
            <h1>{user?.username} 👋</h1>
          </div>
        )}
        <button
          className="icon-btn"
          onClick={toggleTheme}
          aria-label={theme === 'dark' ? 'Ativar tema claro' : 'Ativar tema escuro'}
          title="Alternar tema"
        >
          {theme === 'dark' ? <Sun size={20} /> : <Moon size={20} />}
        </button>
      </header>

      <main>
        <Outlet context={{ refreshKey, openAdd: () => setShowAdd(true) }} />
      </main>

      <nav className="bottom-nav">
        {NAV.slice(0, 2).map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            end={n.to === '/'}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <span className="nav-icon"><n.Icon size={23} /></span>
            {n.label}
          </NavLink>
        ))}

        <button className="nav-item add" onClick={() => setShowAdd(true)}>
          <span className="nav-icon"><Plus size={26} /></span>
          Lançar
        </button>

        {NAV.slice(2).map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <span className="nav-icon"><n.Icon size={23} /></span>
            {n.label}
          </NavLink>
        ))}
      </nav>

      {showAdd && (
        <AddTransactionModal
          onClose={() => setShowAdd(false)}
          onSuccess={() => setRefreshKey((k) => k + 1)}
        />
      )}
    </div>
  )
}
