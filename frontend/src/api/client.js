const API_URL = import.meta.env.VITE_API_URL || '/api/v1'
const TOKEN_KEY = 'finance_token'

export function getToken() {
  return localStorage.getItem(TOKEN_KEY)
}

export function setToken(token) {
  if (token) localStorage.setItem(TOKEN_KEY, token)
  else localStorage.removeItem(TOKEN_KEY)
}

class ApiError extends Error {
  constructor(message, status) {
    super(message)
    this.status = status
  }
}

async function request(path, { method = 'GET', body, auth = true } = {}) {
  const headers = { 'Content-Type': 'application/json' }
  if (auth) {
    const token = getToken()
    if (token) headers['Authorization'] = `Bearer ${token}`
  }

  const res = await fetch(`${API_URL}${path}`, {
    method,
    headers,
    body: body !== undefined ? JSON.stringify(body) : undefined,
  })

  if (res.status === 204) return null

  let data = null
  const text = await res.text()
  if (text) {
    try {
      data = JSON.parse(text)
    } catch {
      data = text
    }
  }

  if (!res.ok) {
    // Auto-logout on expired/invalid token.
    if (res.status === 401 && auth) {
      setToken(null)
    }
    const detail =
      (data && (data.detail || data.message)) ||
      (typeof data === 'string' ? data : 'Erro na requisição')
    const message = Array.isArray(detail)
      ? detail.map((d) => d.msg || JSON.stringify(d)).join(', ')
      : detail
    throw new ApiError(message, res.status)
  }

  return data
}

export const api = {
  // Auth
  register: (payload) =>
    request('/auth/register', { method: 'POST', body: payload, auth: false }),
  login: (email, password) =>
    request('/auth/login/json', {
      method: 'POST',
      body: { email, password },
      auth: false,
    }),

  // User
  getMe: () => request('/users/me'),
  updateMe: (payload) => request('/users/me', { method: 'PATCH', body: payload }),

  // Categories
  getCategories: (type) =>
    request(`/categories${type ? `?type=${type}` : ''}`),
  createCategory: (payload) =>
    request('/categories', { method: 'POST', body: payload }),

  // Transactions
  getTransactions: (params = {}) => {
    const q = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null && v !== '')
    ).toString()
    return request(`/transactions${q ? `?${q}` : ''}`)
  },
  createTransaction: (payload) =>
    request('/transactions', { method: 'POST', body: payload }),
  deleteTransaction: (id) =>
    request(`/transactions/${id}`, { method: 'DELETE' }),

  // Goals
  getGoals: () => request('/goals'),
  createGoal: (payload) => request('/goals', { method: 'POST', body: payload }),
  updateGoal: (id, payload) =>
    request(`/goals/${id}`, { method: 'PATCH', body: payload }),
  contributeGoal: (id, amount) =>
    request(`/goals/${id}/contribute`, { method: 'POST', body: { amount } }),
  deleteGoal: (id) => request(`/goals/${id}`, { method: 'DELETE' }),

  // Fixed expenses
  getFixedExpenses: () => request('/fixed-expenses'),
  createFixedExpense: (payload) =>
    request('/fixed-expenses', { method: 'POST', body: payload }),
  updateFixedExpense: (id, payload) =>
    request(`/fixed-expenses/${id}`, { method: 'PATCH', body: payload }),
  deleteFixedExpense: (id) =>
    request(`/fixed-expenses/${id}`, { method: 'DELETE' }),

  // Dashboard
  getDashboard: (params = {}) => {
    const q = new URLSearchParams(
      Object.entries(params).filter(([, v]) => v !== undefined && v !== null)
    ).toString()
    return request(`/dashboard${q ? `?${q}` : ''}`)
  },
}

export { ApiError }
