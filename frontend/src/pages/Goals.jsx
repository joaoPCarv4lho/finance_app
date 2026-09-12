import { useEffect, useState } from 'react'
import { api } from '../api/client'
import ProgressBar from '../components/ProgressBar.jsx'
import Modal from '../components/Modal.jsx'
import { formatCurrency, formatDate } from '../utils/format'

function CreateGoalModal({ onClose, onSaved }) {
  const [form, setForm] = useState({ name: '', target_amount: '', current_amount: '', target_date: '' })
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)
  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setError('')
    const target = parseFloat(String(form.target_amount).replace(',', '.'))
    if (!target || target <= 0) {
      setError('Informe um valor-alvo maior que zero.')
      return
    }
    setSaving(true)
    try {
      await api.createGoal({
        name: form.name.trim(),
        target_amount: target,
        current_amount: form.current_amount
          ? parseFloat(String(form.current_amount).replace(',', '.'))
          : 0,
        target_date: form.target_date || null,
      })
      onSaved()
      onClose()
    } catch (err) {
      setError(err.message || 'Erro ao salvar.')
      setSaving(false)
    }
  }

  return (
    <Modal title="Nova meta" onClose={onClose}>
      <form onSubmit={submit}>
        {error && <div className="alert">{error}</div>}
        <div className="field">
          <label>Nome da meta</label>
          <input value={form.name} onChange={set('name')} required maxLength={100} placeholder="Ex: Reserva de Emergência" />
        </div>
        <div className="field">
          <label>Valor-alvo (R$)</label>
          <input type="number" step="0.01" min="0" value={form.target_amount} onChange={set('target_amount')} required placeholder="10000,00" />
        </div>
        <div className="field">
          <label>Já tenho guardado (opcional)</label>
          <input type="number" step="0.01" min="0" value={form.current_amount} onChange={set('current_amount')} placeholder="0,00" />
        </div>
        <div className="field">
          <label>Data-alvo (opcional)</label>
          <input type="date" value={form.target_date} onChange={set('target_date')} />
        </div>
        <button className="btn" type="submit" disabled={saving}>
          {saving ? 'Salvando...' : 'Criar meta'}
        </button>
      </form>
    </Modal>
  )
}

function ContributeModal({ goal, onClose, onSaved }) {
  const [amount, setAmount] = useState('')
  const [error, setError] = useState('')
  const [saving, setSaving] = useState(false)

  async function submit(e) {
    e.preventDefault()
    setError('')
    const value = parseFloat(String(amount).replace(',', '.'))
    if (!value) {
      setError('Informe um valor.')
      return
    }
    setSaving(true)
    try {
      await api.contributeGoal(goal.id, value)
      onSaved()
      onClose()
    } catch (err) {
      setError(err.message || 'Erro ao guardar.')
      setSaving(false)
    }
  }

  return (
    <Modal title={`Guardar em "${goal.name}"`} onClose={onClose}>
      <form onSubmit={submit}>
        {error && <div className="alert">{error}</div>}
        <p className="muted" style={{ fontSize: '0.85rem', marginBottom: 12 }}>
          Atual: {formatCurrency(goal.current_amount)} de {formatCurrency(goal.target_amount)}
        </p>
        <div className="field">
          <label>Valor a guardar (R$)</label>
          <input type="number" step="0.01" inputMode="decimal" value={amount} autoFocus onChange={(e) => setAmount(e.target.value)} placeholder="0,00" />
        </div>
        <p className="muted" style={{ fontSize: '0.75rem', marginBottom: 12 }}>
          Dica: use um valor negativo para corrigir/retirar.
        </p>
        <button className="btn" type="submit" disabled={saving}>
          {saving ? 'Guardando...' : 'Guardar'}
        </button>
      </form>
    </Modal>
  )
}

export default function Goals() {
  const [goals, setGoals] = useState([])
  const [loading, setLoading] = useState(true)
  const [showCreate, setShowCreate] = useState(false)
  const [contributeGoal, setContributeGoal] = useState(null)

  async function load() {
    setLoading(true)
    setGoals(await api.getGoals())
    setLoading(false)
  }
  useEffect(() => {
    load().catch(() => setLoading(false))
  }, [])

  async function remove(g) {
    if (!confirm(`Excluir a meta "${g.name}"?`)) return
    await api.deleteGoal(g.id)
    setGoals((prev) => prev.filter((x) => x.id !== g.id))
  }

  return (
    <>
      <button className="btn" style={{ marginTop: 8 }} onClick={() => setShowCreate(true)}>
        + Nova meta
      </button>

      {loading ? (
        <div className="spinner" />
      ) : goals.length === 0 ? (
        <div className="card empty mt-16">
          <span className="emoji">🎯</span>
          Você ainda não tem metas.
          <br />
          Comece pela <strong>Reserva de Emergência</strong> — o primeiro passo para investir!
        </div>
      ) : (
        <div className="mt-16">
          {goals.map((g) => (
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
              {!g.is_completed && (
                <div className="goal-amounts" style={{ marginTop: 2 }}>
                  <span>Faltam {formatCurrency(g.remaining_amount)}</span>
                  {g.target_date && <span>até {formatDate(g.target_date)}</span>}
                </div>
              )}
              <div className="row-between mt-16" style={{ gap: 8 }}>
                <button className="btn small" onClick={() => setContributeGoal(g)}>
                  💰 Guardar
                </button>
                <button
                  className="btn small secondary"
                  style={{ color: 'var(--expense)' }}
                  onClick={() => remove(g)}
                >
                  Excluir
                </button>
              </div>
            </div>
          ))}
        </div>
      )}

      {showCreate && <CreateGoalModal onClose={() => setShowCreate(false)} onSaved={load} />}
      {contributeGoal && (
        <ContributeModal goal={contributeGoal} onClose={() => setContributeGoal(null)} onSaved={load} />
      )}
    </>
  )
}
