import { useEffect, useState } from 'react'
import { useNavigate, useSearchParams } from 'react-router-dom'
import { Plus, Wallet, Trash2, Pencil } from 'lucide-react'
import { api } from '../api/client'
import Modal from '../components/Modal.jsx'
import { formatCurrency } from '../utils/format'

function FixedExpenseModal({ expense, onClose, onSaved }) {
  const [form, setForm] = useState({
    name: expense?.name ?? '',
    amount: expense ? String(expense.amount) : '',
  })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setError('')
    const amount = parseFloat(String(form.amount).replace(',', '.'))
    if (!amount || amount <= 0) {
      setError('Informe um valor maior que zero.')
      return
    }
    setSaving(true)
    try {
      const payload = { name: form.name.trim(), amount }
      if (expense) {
        await api.updateFixedExpense(expense.id, payload)
      } else {
        await api.createFixedExpense(payload)
      }
      onSaved()
      onClose()
    } catch (err) {
      setError(err.message || 'Erro ao salvar.')
      setSaving(false)
    }
  }

  return (
    <Modal title={expense ? 'Editar gasto fixo' : 'Novo gasto fixo'} onClose={onClose}>
      <form onSubmit={submit}>
        {error && <div className="alert">{error}</div>}
        <div className="field">
          <label>Nome do gasto</label>
          <input
            value={form.name}
            onChange={set('name')}
            required
            maxLength={100}
            placeholder="Ex: Aluguel"
          />
        </div>
        <div className="field">
          <label>Valor mensal (R$)</label>
          <input
            type="number"
            step="0.01"
            min="0"
            value={form.amount}
            onChange={set('amount')}
            required
            placeholder="Ex: 1200,00"
          />
        </div>
        <button className="btn" type="submit" disabled={saving}>
          {saving ? 'Salvando...' : 'Salvar'}
        </button>
      </form>
    </Modal>
  )
}

export default function FixedExpenses() {
  const [expenses, setExpenses] = useState([])
  const [loading, setLoading] = useState(true)
  const [showForm, setShowForm] = useState(false)
  const [editing, setEditing] = useState(null)
  const [searchParams] = useSearchParams()
  const navigate = useNavigate()
  const isOnboarding = searchParams.get('onboarding') === '1'

  async function load() {
    setLoading(true)
    setExpenses(await api.getFixedExpenses())
    setLoading(false)
  }
  useEffect(() => {
    load().catch(() => setLoading(false))
  }, [])

  async function remove(item) {
    if (!confirm(`Excluir "${item.name}"?`)) return
    await api.deleteFixedExpense(item.id)
    setExpenses((prev) => prev.filter((x) => x.id !== item.id))
  }

  const total = expenses.reduce((sum, item) => sum + Number(item.amount), 0)

  return (
    <>
      {isOnboarding && (
        <div className="alert info mt-16">
          Antes de começar, quais são seus gastos fixos mensais? Isso ajuda o
          app a calcular quanto você pode guardar por mês em cada meta.
        </div>
      )}

      <div className="card mt-16">
        <div className="row-between">
          <h2 className="card-title"><Wallet size={18} /> Total mensal</h2>
          <span className="tnum">{formatCurrency(total)}</span>
        </div>
      </div>

      <button
        className="btn"
        style={{ marginTop: 16 }}
        onClick={() => { setEditing(null); setShowForm(true) }}
      >
        <Plus size={18} /> Novo gasto fixo
      </button>

      {loading ? (
        <div className="spinner" />
      ) : expenses.length === 0 ? (
        <div className="card empty mt-16">
          <div className="empty-ic"><Wallet size={26} /></div>
          Você ainda não cadastrou gastos fixos.
          <br />
          Ex: aluguel, internet, streaming, plano de saúde.
        </div>
      ) : (
        <div className="mt-16">
          {expenses.map((item) => (
            <div className="card goal-card" key={item.id}>
              <div className="goal-head">
                <span className="goal-name">{item.name}</span>
                <span className="tnum">{formatCurrency(item.amount)}</span>
              </div>
              <div className="row-between mt-16" style={{ gap: 8 }}>
                <button
                  className="btn small secondary"
                  onClick={() => { setEditing(item); setShowForm(true) }}
                >
                  <Pencil size={15} /> Editar
                </button>
                <button
                  className="btn small secondary"
                  style={{ color: 'var(--expense)' }}
                  onClick={() => remove(item)}
                >
                  <Trash2 size={15} /> Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {isOnboarding && (
        <div className="row-between mt-16" style={{ gap: 8 }}>
          <button className="btn secondary" onClick={() => navigate('/')}>
            Pular por agora
          </button>
          <button className="btn" onClick={() => navigate('/')}>
            Concluir e ir para o Dashboard
          </button>
        </div>
      )}

      {showForm && (
        <FixedExpenseModal
          expense={editing}
          onClose={() => setShowForm(false)}
          onSaved={load}
        />
      )}
    </>
  )
}
