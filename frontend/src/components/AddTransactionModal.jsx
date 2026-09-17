import { useEffect, useState } from 'react'
import { TrendingUp, TrendingDown, LineChart } from 'lucide-react'
import { api } from '../api/client'
import { TYPE_LABELS } from '../utils/format'
import Modal from './Modal.jsx'

const TYPE_ICONS = {
  INCOME: TrendingUp,
  EXPENSE: TrendingDown,
  INVESTMENT: LineChart,
}
const today = () => new Date().toISOString().slice(0, 10)

export default function AddTransactionModal({ onClose, onSuccess }) {
  const [type, setType] = useState('EXPENSE')
  const [amount, setAmount] = useState('')
  const [description, setDescription] = useState('')
  const [date, setDate] = useState(today())
  const [categoryId, setCategoryId] = useState('')
  const [categories, setCategories] = useState([])
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  // Load categories for the selected type.
  useEffect(() => {
    let active = true
    api
      .getCategories(type)
      .then((cats) => {
        if (!active) return
        setCategories(cats)
        setCategoryId(cats[0]?.id || '')
      })
      .catch(() => active && setCategories([]))
    return () => {
      active = false
    }
  }, [type])

  async function submit(e) {
    e.preventDefault()
    setError('')
    const value = parseFloat(String(amount).replace(',', '.'))
    if (!value || value <= 0) {
      setError('Informe um valor maior que zero.')
      return
    }
    setSaving(true)
    try {
      await api.createTransaction({
        amount: value,
        type,
        category_id: categoryId || null,
        description: description.trim() || null,
        transaction_date: date,
      })
      onSuccess?.()
      onClose()
    } catch (err) {
      setError(err.message || 'Não foi possível salvar.')
      setSaving(false)
    }
  }

  return (
    <Modal title="Novo lançamento" onClose={onClose}>
      <form onSubmit={submit}>
        <div className="type-toggle">
          {['INCOME', 'EXPENSE', 'INVESTMENT'].map((t) => {
            const Icon = TYPE_ICONS[t]
            return (
              <button
                type="button"
                key={t}
                data-type={t}
                className={type === t ? 'active' : ''}
                onClick={() => setType(t)}
              >
                <Icon size={20} />
                {TYPE_LABELS[t]}
              </button>
            )
          })}
        </div>

        {error && <div className="alert">{error}</div>}

        <div className="field">
          <label>Valor (R$)</label>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            placeholder="0,00"
            value={amount}
            autoFocus
            onChange={(e) => setAmount(e.target.value)}
          />
        </div>

        <div className="field">
          <label>Categoria</label>
          <select value={categoryId} onChange={(e) => setCategoryId(e.target.value)}>
            <option value="">Sem categoria</option>
            {categories.map((c) => (
              <option key={c.id} value={c.id}>
                {c.icon ? `${c.icon} ` : ''}
                {c.name}
              </option>
            ))}
          </select>
        </div>

        <div className="field">
          <label>Descrição (opcional)</label>
          <input
            type="text"
            placeholder="Ex: Mercado, Salário..."
            value={description}
            maxLength={255}
            onChange={(e) => setDescription(e.target.value)}
          />
        </div>

        <div className="field">
          <label>Data</label>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} />
        </div>

        <button className="btn" type="submit" disabled={saving}>
          {saving ? 'Salvando...' : 'Adicionar lançamento'}
        </button>
      </form>
    </Modal>
  )
}
