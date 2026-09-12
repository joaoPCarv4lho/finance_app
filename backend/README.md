# Finance App — Backend

API RESTful para gestão de finanças pessoais, simples e intuitiva. O foco são
duas métricas:

1. **Teto de gastos** — quanto você pode gastar hoje / no mês com segurança.
2. **Progresso rumo ao primeiro investimento** — metas com barra de progresso.

Construída com **FastAPI + SQLAlchemy (async) + JWT + bcrypt**. Documentação
OpenAPI/Swagger nativa em `/docs` e `/redoc`.

## Requisitos atendidos

| Req  | Descrição | Onde |
|------|-----------|------|
| RF01 | Cadastro, login (senha com bcrypt) e JWT | `POST /auth/register`, `/auth/login`, `/auth/login/json` |
| RF02 | Registro rápido de Entradas/Saídas/Investimentos | `POST /transactions` |
| RF03 | Teto de gastos (50/30/20 ou orçamento livre) | `GET /dashboard/spending-ceiling` |
| RF04 | Metas de economia/investimento com progresso | `/goals`, `POST /goals/{id}/contribute` |
| RF05 | Resumo com 3 números (entradas, saídas, investido) | `GET /dashboard/summary` |
| RNF02| Hash de senha com bcrypt | `app/core/security.py` |
| RNF03| API REST documentada via OpenAPI (Swagger) | `/docs` |

## Como rodar

### Opção 1 — Local (SQLite, sem infraestrutura extra)

```bash
python -m venv venv
venv\Scripts\activate            # Windows
pip install -r requirements.txt
cp .env.example .env             # opcional; há defaults sensatos
uvicorn app.main:app --reload
```

Acesse a documentação interativa em http://localhost:8000/docs

### Opção 2 — Docker (PostgreSQL)

```bash
docker compose up --build
```

A API sobe em http://localhost:8000 conectada ao PostgreSQL.

## Fluxo básico

1. `POST /api/v1/auth/register` → recebe um `access_token` (JWT). Categorias
   padrão já são criadas para o novo usuário.
2. Envie o token no header `Authorization: Bearer <token>` nas demais chamadas.
3. Lance transações (`/transactions`), crie metas (`/goals`) e acompanhe tudo
   no `/dashboard`.

## Cálculo do teto de gastos (RF03)

- **Regra 50/30/20** (padrão): 80% da renda é gastável (50% necessidades + 30%
  desejos), 20% reservado para poupança/investimento.
- **Orçamento livre**: o usuário define um teto mensal próprio via
  `PATCH /users/me` (`budget_mode = FREE`, `monthly_budget = <valor>`).

`safe_to_spend_today = (teto do mês − gasto no mês) ÷ dias restantes do mês`.

## Estrutura

```
app/
├── core/         # config, database, security (JWT/bcrypt), tipo GUID portável
├── models/       # User, Transaction, Category, Goal (SQLAlchemy)
├── schemas/      # Pydantic (validação + serialização)
├── services/     # regras de negócio (budget, dashboard, transações, metas)
├── api/
│   ├── deps.py           # injeção de sessão e usuário autenticado
│   └── v1/endpoints/     # auth, users, categories, transactions, goals, dashboard
└── main.py       # app FastAPI, CORS, criação de tabelas no startup
```

> **Migrations:** por simplicidade as tabelas são criadas no startup. `alembic`
> já está nas dependências para migrations em produção.
