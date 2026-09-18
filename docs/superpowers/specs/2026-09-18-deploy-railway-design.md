# Deploy no Railway (backend + frontend + PostgreSQL)

**Data:** 2026-09-18
**Status:** Aprovado

## Contexto

O app ("Meu Bolso") hoje só roda localmente: backend FastAPI (SQLite local
ou PostgreSQL via `docker-compose`) e frontend React/Vite (`npm run dev` /
`vite preview`). Não existe nenhum fluxo de deploy, infraestrutura
provisionada ou CI/CD. O repositório já está no GitHub
(`joaoPCarv4lho/finance_app`).

## Objetivo

Publicar a aplicação (backend + banco + frontend) no Railway, acessível por
uma URL pública, com deploy automático a cada push em `main`. Sem domínio
próprio por enquanto (URL gerada pelo Railway). Sem migração de dados —
`backend/finance_app.db` só tem dados de teste e será descartado; o banco de
produção nasce vazio.

Fora de escopo: domínio customizado, Alembic/migrations formais (o app já
cria tabelas via `Base.metadata.create_all` no startup — mantém esse
comportamento em produção), autenticação multiusuário além do que já existe,
monitoramento/observabilidade avançada.

## Arquitetura

Um projeto no Railway, conectado ao GitHub, com três peças:

1. **Postgres** — plugin gerenciado do Railway (provisiona `DATABASE_URL`
   automaticamente).
2. **backend** — serviço web, root directory `backend/`, build via o
   `Dockerfile` já existente (Railway detecta e usa Dockerfile
   automaticamente), porta 8000, healthcheck em `GET /health`.
3. **frontend** — serviço web, root directory `frontend/`, build via
   Nixpacks (`npm install && npm run build`), servido por `serve -s dist`.

Os dois serviços web (`backend`, `frontend`) e o Postgres cada um redeploya
de forma independente. Como cada serviço tem root directory configurado
para a sua pasta, um push que só mexe em `frontend/` não reconstrói o
`backend` (e vice-versa).

## Mudanças de código necessárias

### Backend — normalização de `DATABASE_URL`

O Postgres gerenciado do Railway expõe a variável `DATABASE_URL` no formato
`postgresql://user:pass@host:port/db`, mas o SQLAlchemy async engine
(`backend/app/core/database.py:12`) precisa do driver assíncrono
(`postgresql+asyncpg://...`). Hoje `DATABASE_URL` é usada como veio, sem
tratamento (`backend/app/core/config.py:19`).

Adicionar um `field_validator` em `Settings.DATABASE_URL`
(`backend/app/core/config.py`) que reescreve o esquema quando necessário:

- `postgres://...` ou `postgresql://...` → `postgresql+asyncpg://...`
- qualquer outro valor (ex: `sqlite+aiosqlite:///...`, já com
  `+asyncpg` explícito) passa direto, sem alteração.

Isso não muda o comportamento local (SQLite) nem o do `docker-compose.yml`
(que já usa `postgresql+asyncpg://` explicitamente).

### Frontend — servidor de produção para o build estático

`vite preview` (usado hoje em `npm run preview`) não é indicado para
produção. Adicionar em `frontend/package.json`:

- dependência `serve` (`^14`).
- script `"start": "serve -s dist -l $PORT"` — usado pelo Railway como start
  command do serviço frontend (o Railway injeta `$PORT`).

## Variáveis de ambiente

**backend** (definidas no serviço Railway, nunca commitadas):

| Variável | Valor |
|---|---|
| `DATABASE_URL` | Referência automática ao serviço Postgres (`${{Postgres.DATABASE_URL}}`) |
| `SECRET_KEY` | Valor aleatório forte gerado no momento do deploy (`openssl rand -hex 32` ou equivalente) — diferente do default em `.env.example` |
| `BACKEND_CORS_ORIGINS` | URL pública do serviço frontend (definida no passo 5 do deploy, abaixo) |
| `ALGORITHM`, `ACCESS_TOKEN_EXPIRE_MINUTES` | Mantêm os defaults do código |

**frontend** (build-time — o Vite embute isso no bundle estático, então
precisa estar setada **antes** do build rodar):

| Variável | Valor |
|---|---|
| `VITE_API_URL` | URL pública do serviço backend + `/api/v1` |

## Ordem do deploy

Existe uma dependência circular de URLs (o frontend precisa saber a URL do
backend para o build; o backend precisa saber a URL do frontend para CORS),
resolvida fazendo o deploy em duas rodadas:

1. Criar projeto no Railway, conectar ao repositório GitHub
   `joaoPCarv4lho/finance_app`, branch `main`.
2. Adicionar o plugin **Postgres** ao projeto.
3. Criar o serviço **backend** (root directory `backend/`), configurar as
   variáveis de ambiente com `BACKEND_CORS_ORIGINS="*"` temporário. Deploy.
   Anotar a URL pública gerada (ex:
   `https://finance-app-backend-production.up.railway.app`).
4. Criar o serviço **frontend** (root directory `frontend/`), configurar
   `VITE_API_URL=<url do backend>/api/v1`. Deploy. Anotar a URL pública
   gerada.
5. Voltar no serviço **backend**, atualizar `BACKEND_CORS_ORIGINS` para a
   URL real do frontend (passo 4). Redeploy do backend (só essa variável
   muda, não precisa rebuildar a imagem Docker — Railway reinicia o
   container com a env var nova).

## Validação pós-deploy

- `GET https://<url-backend>/health` retorna `{"status": "healthy"}`.
- Abrir a URL do frontend, cadastrar um usuário novo, logar, criar uma
  transação e uma meta, conferir que o dashboard mostra os números
  corretos.
- Verificar no DevTools do navegador que não há erro de CORS nas chamadas
  para `/api/v1/...`.
- Confirmar que a URL do frontend carrega em HTTPS (Railway provê
  certificado automaticamente).

## Segurança

- `SECRET_KEY` de produção gerado especificamente para o deploy, nunca o
  valor default de `.env.example`/`docker-compose.yml`.
- `BACKEND_CORS_ORIGINS` restrito à URL exata do frontend em produção (não
  `"*"`), reduzindo a superfície de origens que podem chamar a API.
- `.env` e `*.db` já estão no `.gitignore` — nenhum segredo ou dado local
  vai para o repositório GitHub que o Railway lê.

## Testes

Sem suíte automatizada para o fluxo de deploy em si (é infraestrutura, não
lógica de aplicação). Validação é manual, via o checklist da seção
"Validação pós-deploy" acima, feito uma vez após o primeiro deploy completo
(passos 1–5 da seção "Ordem do deploy").
