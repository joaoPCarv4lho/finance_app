# Meu Bolso — Frontend

Interface web (React + Vite) do app de finanças. Mobile-first, simples e visual,
com foco em duas coisas: **quanto você pode gastar hoje** e o **progresso das suas
metas**.

## Stack

- **React 18** + **Vite 5**
- **React Router 6** (navegação)
- `fetch` puro + Context API (autenticação/JWT) — sem dependências pesadas
- CSS próprio, mobile-first, com navegação inferior estilo app

## Como rodar

Suba o backend antes (porta 8000 — veja `../backend/README.md`). Depois:

```bash
cd frontend
npm install
npm run dev
```

Abra http://localhost:5173. O Vite faz proxy de `/api` → `http://localhost:8000`,
então não é preciso configurar CORS em desenvolvimento.

Para produção:

```bash
npm run build      # gera dist/
npm run preview    # serve o build localmente
```

Se o backend estiver em outra URL, ajuste `VITE_API_URL` (veja `.env.example`).

## Telas

| Tela | Rota | O que faz |
|------|------|-----------|
| Login / Cadastro | `/login`, `/register` | RF01 — autenticação, token salvo no `localStorage` |
| Início (Dashboard) | `/` | Hero "pode gastar hoje" (RF03), 3 números do mês (RF05), metas em destaque (RF04), últimos lançamentos |
| Extrato | `/transactions` | Lista com filtro por tipo e exclusão (RF02) |
| Metas | `/goals` | Criar meta, guardar valor (aporte), barra de progresso (RF04) |
| Perfil | `/settings` | Renda, modo de orçamento (50/30/20 ou livre), **tema claro/escuro**, sair |

O botão **+ Lançar** (centro da barra inferior) abre o formulário rápido de
Entrada / Saída / Investimento a partir de qualquer tela.

## Tema claro/escuro

O app suporta tema **claro** e **escuro**. Alterne pelo botão ☀️/🌙 na barra
superior ou em **Perfil → Aparência**. A escolha é salva no `localStorage`; na
primeira visita o app segue a preferência do sistema (`prefers-color-scheme`).
Um script inline no `index.html` aplica o tema antes da primeira renderização,
evitando o "flash" de tema errado. Toda a paleta usa CSS variables
(`src/index.css`), então novos componentes herdam o tema automaticamente.

## Estrutura

```
src/
├── api/client.js          # wrapper de fetch + endpoints da API
├── context/AuthContext.jsx# estado de autenticação (login/registro/logout)
├── components/            # Layout, Modal, AddTransactionModal, ProgressBar
├── pages/                 # Login, Register, Dashboard, Transactions, Goals, Settings
├── utils/format.js        # formatação de moeda (BRL) e datas
└── index.css              # design system (tokens, cards, nav, etc.)
```
