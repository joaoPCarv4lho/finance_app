import { useState } from 'react'
import { NavLink, Outlet, useLocation } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'
import { useTheme } from '../context/ThemeContext.jsx'
import AddTransactionModal from './AddTransactionModal.jsx'

const NAV = [
  { to: '/', label: 'Início', icon: '🏠' },
  { to: '/transactions', label: 'Extrato', icon: '📋' },
  { to: '/goals', label: 'Metas', icon: '🎯' },
  { to: '/settings', label: 'Perfil', icon: '👤' },
]

const TITLES = {
  '/': null,
  '/transactions': 'Extrato',
  '/goals': 'Minhas Metas',
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
          {theme === 'dark' ? '☀️' : '🌙'}
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
            <span className="nav-icon">{n.icon}</span>
            {n.label}
          </NavLink>
        ))}

        <button className="nav-item add" onClick={() => setShowAdd(true)}>
          <span className="nav-icon">+</span>
          Lançar
        </button>

        {NAV.slice(2).map((n) => (
          <NavLink
            key={n.to}
            to={n.to}
            className={({ isActive }) => `nav-item${isActive ? ' active' : ''}`}
          >
            <span className="nav-icon">{n.icon}</span>
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
