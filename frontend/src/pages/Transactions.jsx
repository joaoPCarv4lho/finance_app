import { useCallback, useEffect, useState } from 'react'
import { useOutletContext } from 'react-router-dom'
import { api } from '../api/client'
import { formatCurrency, formatDate, TYPE_LABELS } from '../utils/format'

const TX_ICON = { INCOME: '⬆️', EXPENSE: '⬇️', INVESTMENT: '📈' }
const SIGN = { INCOME: '+', EXPENSE: '−', INVESTMENT: '' }
const FILTERS = [
  { key: '', label: 'Tudo' },
  { key: 'INCOME', label: 'Entradas' },
  { key: 'EXPENSE', label: 'Saídas' },
  { key: 'INVESTMENT', label: 'Investido' },
]

export default function Transactions() {
  const { refreshKey } = useOutletContext()
  const [items, setItems] = useState([])
  const [filter, setFilter] = useState('')
  const [loading, setLoading] = useState(true)

  const load = useCallback(async () => {
    setLoading(true)
    const data = await api.getTransactions({ type: filter || undefined, limit: 200 })
    setItems(data)
    setLoading(false)
  }, [filter])

  useEffect(() => {
    load().catch(() => setLoading(false))
  }, [load, refreshKey])

  async function remove(id) {
    if (!confirm('Excluir este lançamento?')) return
    await api.deleteTransaction(id)
    setItems((prev) => prev.filter((t) => t.id !== id))
  }

  return (
    <>
      <div className="type-toggle" style={{ gridTemplateColumns: 'repeat(4, 1fr)', marginTop: 8 }}>
        {FILTERS.map((f) => (
          <button
            key={f.key}
            data-type={f.key}
            className={filter === f.key ? 'active' : ''}
            onClick={() => setFilter(f.key)}
            style={{ fontSize: '0.8rem', padding: '10px 4px' }}
          >
            {f.label}
          </button>
        ))}
      </div>

      {loading ? (
        <div className="spinner" />
      ) : items.length === 0 ? (
        <div className="card empty">
          <span className="emoji">🧾</span>
          Nenhum lançamento {filter ? `de ${TYPE_LABELS[filter].toLowerCase()}` : ''} por aqui.
        </div>
      ) : (
        <div className="card">
          {items.map((t) => (
            <div className="tx-item" key={t.id}>
              <div className={`tx-icon ${t.type}`}>{t.category?.icon || TX_ICON[t.type]}</div>
              <div className="tx-main">
                <div className="tx-desc">{t.description || t.category?.name || 'Lançamento'}</div>
                <div className="tx-meta">
                  {t.category?.name || '—'} · {formatDate(t.transaction_date)}
                </div>
              </div>
              <div className={`tx-amount ${t.type}`}>
                {SIGN[t.type]} {formatCurrency(t.amount)}
              </div>
              <button
                className="icon-btn"
                style={{ width: 34, height: 34, boxShadow: 'none', color: 'var(--text-muted)' }}
                onClick={() => remove(t.id)}
                aria-label="Excluir"
              >
                🗑️
              </button>
            </div>
          ))}
        </div>
      )}
    </>
  )
}
