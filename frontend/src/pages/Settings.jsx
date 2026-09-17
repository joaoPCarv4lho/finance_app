import { useState } from 'react'
import { Link } from 'react-router-dom'
import {
  Wallet,
  Palette,
  User,
  LogOut,
  Sun,
  Moon,
  PieChart,
  Pencil,
} from 'lucide-react'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext.jsx'
import { useTheme } from '../context/ThemeContext.jsx'
import { formatCurrency } from '../utils/format'

export default function Settings() {
  const { user, logout, setUser } = useAuth()
  const { theme, setTheme } = useTheme()
  const [income, setIncome] = useState(String(user?.monthly_income ?? ''))
  const [mode, setMode] = useState(user?.budget_mode || 'RULE_50_30_20')
  const [budget, setBudget] = useState(String(user?.monthly_budget ?? ''))
  const [saving, setSaving] = useState(false)
  const [msg, setMsg] = useState('')
  const [error, setError] = useState('')

  async function save(e) {
    e.preventDefault()
    setMsg('')
    setError('')
    setSaving(true)
    try {
      const payload = {
        monthly_income: parseFloat(String(income).replace(',', '.')) || 0,
        budget_mode: mode,
      }
      if (mode === 'FREE') {
        payload.monthly_budget = parseFloat(String(budget).replace(',', '.')) || 0
      }
      const updated = await api.updateMe(payload)
      setUser(updated)
      setMsg('Configurações salvas! ✅')
    } catch (err) {
      setError(err.message || 'Erro ao salvar.')
    } finally {
      setSaving(false)
    }
  }

  const incomeNum = parseFloat(String(income).replace(',', '.')) || 0

  return (
    <>
      <div className="card mt-16">
        <div className="row-between">
          <div>
            <div className="goal-name">{user?.username}</div>
            <div className="muted" style={{ fontSize: '0.85rem' }}>{user?.email}</div>
          </div>
          <div className="avatar"><User size={24} /></div>
        </div>
      </div>

      <form onSubmit={save} className="card mt-16">
        <h2 className="card-title"><Wallet size={18} /> Renda &amp; Orçamento</h2>
        {msg && <div className="alert info">{msg}</div>}
        {error && <div className="alert">{error}</div>}

        <div className="field">
          <label>Renda mensal (R$)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={income}
            onChange={(e) => setIncome(e.target.value)}
            placeholder="Ex: 3000,00"
          />
        </div>

        <div className="field">
          <label>Como calcular seu teto de gastos?</label>
          <div className="type-toggle" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 0 }}>
            <button
              type="button"
              data-type="INVESTMENT"
              className={mode === 'RULE_50_30_20' ? 'active' : ''}
              onClick={() => setMode('RULE_50_30_20')}
            >
              <PieChart size={17} /> Regra 50/30/20
            </button>
            <button
              type="button"
              data-type="INCOME"
              className={mode === 'FREE' ? 'active' : ''}
              onClick={() => setMode('FREE')}
            >
              <Pencil size={16} /> Orçamento livre
            </button>
          </div>
        </div>

        {mode === 'RULE_50_30_20' ? (
          <div className="alert info">
            80% da renda fica disponível para gastos e 20%
            {incomeNum > 0 ? ` (${formatCurrency(incomeNum * 0.2)})` : ''} é reservado
            para poupar/investir.
          </div>
        ) : (
          <div className="field">
            <label>Teto de gastos do mês (R$)</label>
            <input
              type="number"
              step="0.01"
              min="0"
              value={budget}
              onChange={(e) => setBudget(e.target.value)}
              placeholder="Quanto pretende gastar por mês?"
            />
          </div>
        )}

        <button className="btn" type="submit" disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </form>

      <div className="card mt-16">
        <div className="row-between">
          <div>
            <h2 className="card-title" style={{ marginBottom: 2 }}>
              <Wallet size={18} /> Gastos fixos
            </h2>
            <div className="muted" style={{ fontSize: '0.85rem' }}>
              Aluguel, internet, streaming e outras contas mensais.
            </div>
          </div>
          <Link className="btn small secondary" to="/gastos-fixos">
            Gerenciar
          </Link>
        </div>
      </div>

      <div className="card mt-16">
        <h2 className="card-title"><Palette size={18} /> Aparência</h2>
        <div className="field" style={{ marginBottom: 0 }}>
          <label>Tema do app</label>
          <div className="type-toggle" style={{ gridTemplateColumns: '1fr 1fr', marginBottom: 0 }}>
            <button
              type="button"
              data-type="INCOME"
              className={theme === 'light' ? 'active' : ''}
              onClick={() => setTheme('light')}
            >
              <Sun size={17} /> Claro
            </button>
            <button
              type="button"
              data-type="INVESTMENT"
              className={theme === 'dark' ? 'active' : ''}
              onClick={() => setTheme('dark')}
            >
              <Moon size={16} /> Escuro
            </button>
          </div>
        </div>
      </div>

      <button className="btn secondary mt-16" style={{ color: 'var(--expense)' }} onClick={logout}>
        <LogOut size={17} /> Sair da conta
      </button>

      <p className="center muted mt-16" style={{ fontSize: '0.75rem' }}>
        Meu Bolso · Finanças simples
      </p>
    </>
  )
}
