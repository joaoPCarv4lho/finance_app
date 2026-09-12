import { useCallback, useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext.jsx'
import ProgressBar from '../components/ProgressBar.jsx'
import { formatCurrency, formatDate, MONTH_NAMES } from '../utils/format'

const TX_ICON = { INCOME: '⬆️', EXPENSE: '⬇️', INVESTMENT: '📈' }
const SIGN = { INCOME: '+', EXPENSE: '−', INVESTMENT: '' }

export default function Dashboard() {
  const { user } = useAuth()
  const { refreshKey } = useOutletContext()
  const [data, setData] = useState(null)
  const [goals, setGoals] = useState([])
  const [recent, setRecent] = useState([])
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    const [dash, gs, txs] = await Promise.all([
      api.getDashboard(),
      api.getGoals(),
      api.getTransactions({ limit: 4 }),
    ])
    setData(dash)
    setGoals(gs)
    setRecent(txs)
    setLoading(false)
  }, [])

  useEffect(() => {
    load().catch(() => setLoading(false))
  }, [load, refreshKey])

  if (loading) return <div className="spinner" />
  if (!data) return <div className="empty">Não foi possível carregar os dados.</div>

  const { summary, ceiling } = data
  const now = new Date()
  const hasIncome = Number(ceiling.monthly_budget) > 0
  const spentRatio = hasIncome
    ? Math.min((Number(ceiling.spent_this_month) / Number(ceiling.monthly_budget)) * 100, 100)
    : 0

  // Highlight the closest-to-done unfinished goal, else the first.
  const activeGoals = goals.filter((g) => !g.is_completed)
  const featured = [...(activeGoals.length ? activeGoals : goals)]
    .sort((a, b) => b.progress_percent - a.progress_percent)
    .slice(0, 2)

  return (
    <>
      {/* HERO — how much can I spend (RF03) */}
      {hasIncome ? (
        <div className={`hero${ceiling.over_budget ? ' over' : ''}`}>
          <div className="label">
            {ceiling.over_budget ? '⚠️ Você passou do orçamento' : 'Você pode gastar hoje'}
          </div>
          <div className="amount">{formatCurrency(ceiling.safe_to_spend_today)}</div>
          <div className="sub">
            {ceiling.over_budget
              ? 'Cuidado com os gastos até o fim do mês.'
              : `Faltam ${ceiling.days_left_in_month} dia(s) neste mês`}
          </div>
          <div className="month-line">
            <span>Disponível no mês</span>
            <strong>{formatCurrency(ceiling.safe_to_spend_month)}</strong>
          </div>
          <div className="bar">
            <span style={{ width: `${spentRatio}%` }} />
          </div>
          <div className="month-line" style={{ marginTop: 6, fontSize: '0.76rem' }}>
            <span>Gasto: {formatCurrency(ceiling.spent_this_month)}</span>
            <span>Teto: {formatCurrency(ceiling.monthly_budget)}</span>
          </div>
        </div>
      ) : (
        <div className="hero">
          <div className="label">Configure sua renda</div>
          <div className="amount" style={{ fontSize: '1.4rem', marginTop: 8 }}>
            Defina sua renda mensal
          </div>
          <div className="sub">
            Assim calculamos quanto você pode gastar com segurança.
          </div>
          <Link to="/settings" className="btn secondary" style={{ marginTop: 14, color: 'var(--text)' }}>
            Configurar agora
          </Link>
        </div>
      )}

      {/* SUMMARY — three numbers (RF05) */}
      <div className="section-title">
        {MONTH_NAMES[now.getMonth()]} de {now.getFullYear()}
      </div>
      <div className="stats-row">
        <div className="stat income">
          <div className="stat-icon">⬆️</div>
          <div className="stat-label">Entradas</div>
          <div className="stat-value">{formatCurrency(summary.total_income)}</div>
        </div>
        <div className="stat expense">
          <div className="stat-icon">⬇️</div>
          <div className="stat-label">Saídas</div>
          <div className="stat-value">{formatCurrency(summary.total_expense)}</div>
        </div>
        <div className="stat invest">
          <div className="stat-icon">📈</div>
          <div className="stat-label">Investido</div>
          <div className="stat-value">{formatCurrency(summary.total_invested)}</div>
        </div>
      </div>

      {/* GOALS (RF04) */}
      <div className="section-title">
        Metas
        <Link to="/goals">Ver todas →</Link>
      </div>
      {featured.length === 0 ? (
        <div className="card empty">
          <span className="emoji">🎯</span>
          Crie sua primeira meta — que tal uma reserva de emergência?
          <div className="mt-16">
            <Link to="/goals" className="btn small">Criar meta</Link>
          </div>
        </div>
      ) : (
        featured.map((g) => (
          <div className="card goal-card" key={g.id}>
            <div className="goal-head">
              <span className="goal-name">{g.name}</span>
              {g.is_completed ? (
                <span className="goal-done-badge">Concluída ✓</span>
              ) : (
                <span className="goal-pct">{g.progress_percent}%</span>
              )}
            </div>
            <ProgressBar percent={g.progress_percent} />
            <div className="goal-amounts">
              <span>{formatCurrency(g.current_amount)}</span>
              <span>Meta: {formatCurrency(g.target_amount)}</span>
            </div>
          </div>
        ))
      )}

      {/* RECENT TRANSACTIONS */}
      <div className="section-title">
        Últimos lançamentos
        <Link to="/transactions">Ver extrato →</Link>
      </div>
      <div className="card">
        {recent.length === 0 ? (
          <div className="empty" style={{ padding: 12 }}>
            Nenhum lançamento ainda. Toque em <strong>+ Lançar</strong> para começar.
          </div>
        ) : (
          recent.map((t) => (
            <div className="tx-item" key={t.id}>
              <div className={`tx-icon ${t.type}`}>
                {t.category?.icon || TX_ICON[t.type]}
              </div>
              <div className="tx-main">
                <div className="tx-desc">
                  {t.description || t.category?.name || 'Lançamento'}
                </div>
                <div className="tx-meta">
                  {t.category?.name || '—'} · {formatDate(t.transaction_date)}
                </div>
              </div>
              <div className={`tx-amount ${t.type}`}>
                {SIGN[t.type]} {formatCurrency(t.amount)}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  )
}
