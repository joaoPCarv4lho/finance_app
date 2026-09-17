import { useState } from 'react'
import { Link } from 'react-router-dom'
import { useAuth } from '../context/AuthContext.jsx'

export default function Register() {
  const { register } = useAuth()
  const [form, setForm] = useState({
    username: '',
    email: '',
    password: '',
    monthly_income: '',
  })
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)

  const set = (k) => (e) => setForm((f) => ({ ...f, [k]: e.target.value }))

  async function submit(e) {
    e.preventDefault()
    setError('')
    if (form.password.length < 6) {
      setError('A senha deve ter ao menos 6 caracteres.')
      return
    }
    setLoading(true)
    try {
      await register({
        username: form.username.trim(),
        email: form.email.trim(),
        password: form.password,
        monthly_income: form.monthly_income
          ? parseFloat(String(form.monthly_income).replace(',', '.'))
          : 0,
      })
    } catch (err) {
      setError(err.message || 'Não foi possível criar a conta.')
      setLoading(false)
    }
  }

  return (
    <div className="auth-wrap">
      <div className="auth-logo">
        <div className="brand-badge">💰</div>
        <h1>Criar conta</h1>
        <p>Comece a organizar sua vida financeira hoje.</p>
      </div>

      <form onSubmit={submit} className="card">
        {error && <div className="alert">{error}</div>}
        <div className="field">
          <label>Nome de usuário</label>
          <input
            type="text"
            value={form.username}
            onChange={set('username')}
            required
            minLength={3}
            placeholder="Como quer ser chamado?"
          />
        </div>
        <div className="field">
          <label>E-mail</label>
          <input type="email" value={form.email} onChange={set('email')} required placeholder="voce@email.com" />
        </div>
        <div className="field">
          <label>Senha</label>
          <input
            type="password"
            value={form.password}
            onChange={set('password')}
            required
            minLength={6}
            placeholder="Mínimo 6 caracteres"
          />
        </div>
        <div className="field">
          <label>Renda mensal (opcional)</label>
          <input
            type="number"
            inputMode="decimal"
            step="0.01"
            min="0"
            value={form.monthly_income}
            onChange={set('monthly_income')}
            placeholder="Ex: 3000,00"
          />
        </div>
        <button className="btn" type="submit" disabled={loading}>
          {loading ? 'Criando...' : 'Criar conta'}
        </button>
      </form>

      <p className="auth-switch">
        Já tem conta? <Link to="/login">Entrar</Link>
      </p>
    </div>
  )
}
