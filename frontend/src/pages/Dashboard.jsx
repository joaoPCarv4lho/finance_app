import { useCallback, useEffect, useState } from 'react'
import { Link, useOutletContext } from 'react-router-dom'
import {
  TrendingUp,
  TrendingDown,
  LineChart,
  ChevronRight,
  Target,
  Sparkles,
  AlertTriangle,
  AlertCircle,
  ArrowRight,
} from 'lucide-react'
import { api } from '../api/client'
import { useAuth } from '../context/AuthContext.jsx'
import ProgressBar from '../components/ProgressBar.jsx'
import SpendingGauge from '../components/SpendingGauge.jsx'
import { formatCurrency, formatDate, MONTH_NAMES } from '../utils/format'

const TX_ICON = { INCOME: '⬆️', EXPENSE: '⬇️', INVESTMENT: '📈' }
const SIGN = { INCOME: '+', EXPENSE: '−', INVESTMENT: '' }

function monthRange() {
  const now = new Date()
  const y = now.getFullYear()
  const m = now.getMonth()
  const pad = (n) => String(n).padStart(2, '0')
  const last = new Date(y, m + 1, 0).getDate()
  return {
    start: `${y}-${pad(m + 1)}-01`,
    end: `${y}-${pad(m + 1)}-${pad(last)}`,
    monthName: MONTH_NAMES[m],
    year: y,
  }
}

function topCategories(expenses) {
  const map = {}
  for (const t of expenses) {
    const key = t.category?.name || 'Outros'
    if (!map[key]) map[key] = { name: key, emoji: t.category?.icon || '💸', total: 0 }
    map[key].total += Number(t.amount)
  }
  return Object.values(map).sort((a, b) => b.total - a.total).slice(0, 3)
}

export default function Dashboard() {
  const { user } = useAuth()
  const { refreshKey } = useOutletContext()
  const [data, setData] = useState(null)
  const [goals, setGoals] = useState([])
  const [recent, setRecent] = useState([])
  const [cats, setCats] = useState([])
  const [loading, setLoading] = useState(true)

  const range = monthRange()

  const load = useCallback(async () => {
    const [dash, gs, txs, monthExpenses] = await Promise.all([
      api.getDashboard(),
      api.getGoals(),
      api.getTransactions({ limit: 4 }),
      api.getTransactions({ type: 'EXPENSE', start_date: range.start, end_date: range.end, limit: 200 }),
    ])
    setData(dash)
    setGoals(gs)
    setRecent(txs)
    setCats(topCategories(monthExpenses))
    setLoading(false)
  }, [range.start, range.end])

  useEffect(() => {
    load().catch(() => setLoading(false))
  }, [load, refreshKey])

  if (loading) return <div className="spinner" />
  if (!data) return <div className="empty">Não foi possível carregar os dados.</div>

  const { summary, ceiling } = data
  const hasIncome = Number(ceiling.monthly_budget) > 0
  const spent = Number(ceiling.spent_this_month)
  const budget = Number(ceiling.monthly_budget)
  const ratio = budget > 0 ? spent / budget : 0

  const state = ceiling.over_budget ? 'over' : ratio >= 0.8 ? 'warn' : 'ok'
  const STATUS = {
    ok: { label: 'Tranquilo', Icon: Sparkles },
    warn: { label: 'Atenção', Icon: AlertTriangle },
    over: { label: 'No limite', Icon: AlertCircle },
  }[state]

  const activeGoals = goals.filter((g) => !g.is_completed)
  const featured = [...(activeGoals.length ? activeGoals : goals)]
    .sort((a, b) => b.progress_percent - a.progress_percent)
    .slice(0, 2)

  const catMax = cats[0]?.total || 1

  return (
    <>
      {/* HERO — spending-ceiling gauge (RF03) */}
      {hasIncome ? (
        <div className="gauge-card">
          <div className="row-between" style={{ marginBottom: 2 }}>
            <div>
              <div className="gauge-label">Disponível no mês</div>
              <div className="tnum" style={{ fontSize: '1.15rem', fontWeight: 800, letterSpacing: '-0.02em' }}>
                {formatCurrency(ceiling.safe_to_spend_month)}
              </div>
            </div>
            <span className={`chip ${state}`}>
              <STATUS.Icon size={13} /> {STATUS.label}
            </span>
          </div>

          <SpendingGauge
            spent={spent}
            budget={budget}
            todayValue={ceiling.safe_to_spend_today}
            state={state}
            subtitle={
              ceiling.over_budget
                ? 'Cuidado com os gastos até o fim do mês'
                : `Faltam ${ceiling.days_left_in_month} dia(s) neste mês`
            }
          />

          <div className="gauge-foot">
            <span>
              <span className="lbl">Gasto </span>
              <span className="val tnum">{formatCurrency(spent)}</span>
            </span>
            <span>
              <span className="lbl">Teto </span>
              <span className="val tnum">{formatCurrency(budget)}</span>
            </span>
          </div>
        </div>
      ) : (
        <div className="onboard">
          <div className="oy-ic">
            <Target size={24} />
          </div>
          <h2>Vamos começar?</h2>
          <p>Defina sua renda mensal para descobrirmos quanto você pode gastar com segurança todo dia.</p>
          <Link to="/settings" className="btn">
            Configurar renda <ArrowRight size={18} />
          </Link>
        </div>
      )}

      {/* SUMMARY — three numbers (RF05) */}
      <div className="section-title">
        {range.monthName} de {range.year}
      </div>
      <div className="stats-row">
        <div className="stat income">
          <div className="stat-ic"><TrendingUp size={17} /></div>
          <div className="stat-label">Entradas</div>
          <div className="stat-value tnum">{formatCurrency(summary.total_income)}</div>
        </div>
        <div className="stat expense">
          <div className="stat-ic"><TrendingDown size={17} /></div>
          <div className="stat-label">Saídas</div>
          <div className="stat-value tnum">{formatCurrency(summary.total_expense)}</div>
        </div>
        <div className="stat invest">
          <div className="stat-ic"><LineChart size={17} /></div>
          <div className="stat-label">Investido</div>
          <div className="stat-value tnum">{formatCurrency(summary.total_invested)}</div>
        </div>
      </div>

      {/* CATEGORY BREAKDOWN — top-3 expenses */}
      {cats.length > 0 && (
        <>
          <div className="section-title">Para onde foi seu dinheiro</div>
          <div className="card">
            <div className="cat-list">
              {cats.map((c) => (
                <div className="cat-row" key={c.name}>
                  <span className="cat-emoji">{c.emoji}</span>
                  <div>
                    <div className="cat-name">{c.name}</div>
                    <div className="cat-bar">
                      <span style={{ width: `${(c.total / catMax) * 100}%` }} />
                    </div>
                  </div>
                  <span className="cat-amt tnum">{formatCurrency(c.total)}</span>
                </div>
              ))}
            </div>
          </div>
        </>
      )}

      {/* GOALS (RF04) */}
      <div className="section-title">
        Metas
        <Link to="/goals">Ver todas <ChevronRight size={15} /></Link>
      </div>
      {featured.length === 0 ? (
        <div className="card empty">
          <div className="empty-ic"><Target size={26} /></div>
          Crie sua primeira meta — que tal uma reserva de emergência?
          <div className="mt-16">
            <Link to="/goals" className="btn small">Criar meta</Link>
          </div>
        </div>
      ) : (
        featured.map((g) => (
          <div className={`card goal-card${g.is_completed ? ' complete' : ''}`} key={g.id}>
            <div className="goal-head">
              <span className="goal-name">{g.name}</span>
              {g.is_completed ? (
                <span className="goal-done-badge">Concluída ✓</span>
              ) : (
                <span className="goal-pct tnum">{g.progress_percent}%</span>
              )}
            </div>
            <ProgressBar percent={g.progress_percent} />
            <div className="goal-amounts">
              <span className="tnum">{formatCurrency(g.current_amount)}</span>
              <span className="tnum">Meta: {formatCurrency(g.target_amount)}</span>
            </div>
          </div>
        ))
      )}

      {/* RECENT TRANSACTIONS */}
      <div className="section-title">
        Últimos lançamentos
        <Link to="/transactions">Ver extrato <ChevronRight size={15} /></Link>
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
              <div className={`tx-amount ${t.type} tnum`}>
                {SIGN[t.type]} {formatCurrency(t.amount)}
              </div>
            </div>
          ))
        )}
      </div>
    </>
  )
}
