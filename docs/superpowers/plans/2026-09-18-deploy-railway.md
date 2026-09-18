# Deploy no Railway — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Publicar o backend (FastAPI), o banco (PostgreSQL) e o frontend (React/Vite) no Railway, com URL pública HTTPS e deploy automático a cada push em `main`.

**Architecture:** Um projeto Railway com três serviços conectados ao repositório GitHub `joaoPCarv4lho/finance_app`: um Postgres gerenciado, um serviço `backend` (root directory `backend/`, build via o `Dockerfile` já existente) e um serviço `frontend` (root directory `frontend/`, build Nixpacks servindo o `dist/` estático via `serve`). Duas pequenas mudanças de código preparam o repo para isso; o resto é provisionamento e configuração no Railway.

**Tech Stack:** Railway (PaaS + Postgres gerenciado), Docker (backend, Dockerfile já existente), Nixpacks (build do frontend), FastAPI + SQLAlchemy async + pydantic-settings (backend), React + Vite + pacote `serve` (frontend), pytest (teste do validator de `DATABASE_URL`).

**Spec:** `docs/superpowers/specs/2026-09-18-deploy-railway-design.md`

## Global Constraints

- `SECRET_KEY` de produção deve ser gerado especificamente para o deploy — nunca o valor default de `backend/.env.example` / `backend/docker-compose.yml`.
- `BACKEND_CORS_ORIGINS` em produção deve terminar sendo a URL exata do frontend, nunca `"*"` (fica `"*"` só temporariamente até a Task 6).
- Sem Alembic/migrations formais neste plano — manter `Base.metadata.create_all` rodando no startup do FastAPI (`backend/app/main.py`), como já é hoje.
- Sem domínio customizado — usar as URLs `*.up.railway.app` geradas automaticamente pelo Railway.
- Sem migração de dados de `backend/finance_app.db` — o Postgres de produção nasce vazio.

---

## Task 1: Backend — normalizar `DATABASE_URL` para o driver asyncpg

**Files:**
- Modify: `backend/app/core/config.py`
- Modify: `backend/requirements.txt`
- Create: `backend/pytest.ini`
- Create: `backend/tests/test_config.py`

**Interfaces:**
- Produces: `Settings.DATABASE_URL` (em `backend/app/core/config.py`) passa a sempre conter o esquema `postgresql+asyncpg://` quando a entrada for `postgres://` ou `postgresql://`; usado por `backend/app/core/database.py:12` (`create_async_engine(settings.DATABASE_URL, ...)`), sem mudanças nesse arquivo.

- [ ] **Step 1: Adicionar pytest às dependências**

Edite `backend/requirements.txt`, adicionando ao final:

```
pytest>=8.0.0
```

Instale:

```bash
cd backend
pip install -r requirements.txt
```

- [ ] **Step 2: Criar `backend/pytest.ini`**

```ini
[pytest]
pythonpath = .
```

Isso garante que `import app.core.config` funcione ao rodar `pytest` a partir de `backend/`, independente do diretório de onde o comando é chamado.

- [ ] **Step 3: Escrever o teste que falha**

Crie `backend/tests/test_config.py`:

```python
import pytest

from app.core.config import Settings


@pytest.mark.parametrize(
    "raw_url,expected_url",
    [
        (
            "postgres://user:pass@host:5432/db",
            "postgresql+asyncpg://user:pass@host:5432/db",
        ),
        (
            "postgresql://user:pass@host:5432/db",
            "postgresql+asyncpg://user:pass@host:5432/db",
        ),
        (
            "postgresql+asyncpg://user:pass@host:5432/db",
            "postgresql+asyncpg://user:pass@host:5432/db",
        ),
        (
            "sqlite+aiosqlite:///./finance_app.db",
            "sqlite+aiosqlite:///./finance_app.db",
        ),
    ],
)
def test_database_url_normalizes_to_asyncpg_driver(raw_url, expected_url):
    settings = Settings(DATABASE_URL=raw_url, _env_file=None)
    assert settings.DATABASE_URL == expected_url
```

- [ ] **Step 4: Rodar o teste e confirmar que falha**

Run: `cd backend && python -m pytest tests/test_config.py -v`
Expected: FAIL — as duas primeiras variações (`postgres://...`, `postgresql://...`) não batem com o valor esperado, porque `Settings.DATABASE_URL` ainda devolve a URL sem transformação.

- [ ] **Step 5: Implementar o validator**

Em `backend/app/core/config.py`, adicione o import e o validator:

```python
from pydantic import field_validator
from pydantic_settings import BaseSettings, SettingsConfigDict
```

Dentro da classe `Settings`, logo após a declaração de `DATABASE_URL`:

```python
    @field_validator("DATABASE_URL")
    @classmethod
    def normalize_database_url(cls, v: str) -> str:
        # Railway expõe o Postgres gerenciado como postgres(ql)://, mas o
        # SQLAlchemy async engine exige o driver asyncpg explícito.
        if v.startswith("postgres://"):
            return "postgresql+asyncpg://" + v[len("postgres://"):]
        if v.startswith("postgresql://"):
            return "postgresql+asyncpg://" + v[len("postgresql://"):]
        return v
```

- [ ] **Step 6: Rodar o teste e confirmar que passa**

Run: `cd backend && python -m pytest tests/test_config.py -v`
Expected: PASS (4 casos parametrizados, todos verdes).

- [ ] **Step 7: Confirmar que o app local ainda sobe**

Run: `cd backend && uvicorn app.main:app --reload`
Expected: sobe normalmente na porta 8000, usando SQLite local (comportamento inalterado). Pare o servidor (Ctrl+C) depois de confirmar.

- [ ] **Step 8: Commit**

```bash
git add backend/app/core/config.py backend/requirements.txt backend/pytest.ini backend/tests/test_config.py
git commit -m "feat(backend): normaliza DATABASE_URL para driver asyncpg em produção"
```

---

## Task 2: Frontend — servidor de produção para o build estático

**Files:**
- Modify: `frontend/package.json`
- Modify: `frontend/package-lock.json` (gerado por `npm install`)

**Interfaces:**
- Produces: script `npm start` em `frontend/package.json`, que roda `serve -s dist -l $PORT` — usado pelo Railway (via Nixpacks) como comando de start do serviço `frontend` na Task 5.

- [ ] **Step 1: Adicionar a dependência `serve` e o script `start`**

Edite `frontend/package.json`:

```json
{
  "name": "finance-app-frontend",
  "private": true,
  "version": "1.0.0",
  "type": "module",
  "scripts": {
    "dev": "vite",
    "build": "vite build",
    "preview": "vite preview",
    "start": "serve -s dist -l $PORT"
  },
  "dependencies": {
    "lucide-react": "^1.46.0",
    "react": "^18.3.1",
    "react-dom": "^18.3.1",
    "react-router-dom": "^6.26.2",
    "serve": "^14.2.1"
  },
  "devDependencies": {
    "@vitejs/plugin-react": "^4.3.1",
    "vite": "^5.4.8"
  }
}
```

(Só adiciona a linha `"start": ...` em `scripts` e a linha `"serve": "^14.2.1"` em `dependencies` — o resto do arquivo fica igual.)

- [ ] **Step 2: Instalar e atualizar o lockfile**

```bash
cd frontend
npm install
```

Expected: `serve` aparece em `frontend/node_modules` e `frontend/package-lock.json` é atualizado.

- [ ] **Step 3: Buildar o frontend**

```bash
npm run build
```

Expected: gera/atualiza `frontend/dist/` sem erros.

- [ ] **Step 4: Verificar o start command localmente**

```bash
PORT=4173 npm start &
sleep 1
curl -s http://localhost:4173 | grep -o '<div id="root">'
kill %1
```

Expected: o `curl` imprime `<div id="root">` (confirma que `serve` está de fato servindo o `index.html` do build), e o processo em background é encerrado no `kill %1`.

- [ ] **Step 5: Commit**

```bash
git add frontend/package.json frontend/package-lock.json
git commit -m "feat(frontend): adiciona serve como servidor de produção do build estático"
```

- [ ] **Step 6: Push para main**

```bash
git push origin main
```

Expected: os commits das Tasks 1 e 2 chegam no GitHub — necessário antes da Task 3, já que o Railway vai buildar a partir do repositório remoto.

---

## Task 3: Provisionar o projeto Railway, o Postgres e conectar o GitHub

> Esta tarefa exige acesso à sua conta Railway (railway.app) e à autorização do GitHub — não pode ser executada por um agente sem essas credenciais. Os passos abaixo são para você (ou para quem estiver com a sessão do navegador autenticada) seguir manualmente.

**Interfaces:**
- Consumes: commits das Tasks 1 e 2 já em `main` no GitHub.
- Produces: projeto Railway com um serviço Postgres ativo e um serviço `backend` vazio (ainda sem variáveis/domínio — configurado na Task 4).

- [ ] **Step 1: Login no Railway**

Acesse https://railway.app e faça login (recomendado: "Login with GitHub", já que o repo está no GitHub e isso facilita a autorização de acesso ao repositório no próximo passo).

- [ ] **Step 2: Criar o projeto a partir do repositório GitHub**

No dashboard, clique **New Project** → **Deploy from GitHub repo** → selecione `joaoPCarv4lho/finance_app`. Se solicitado, autorize o Railway a acessar esse repositório (GitHub App do Railway).

Expected: Railway cria o projeto e um primeiro serviço apontando para a raiz do repositório, com um build que provavelmente falha ou não faz sentido ainda (a raiz do repo não tem um único app buildável) — isso é esperado e corrigido no próximo passo.

- [ ] **Step 3: Configurar esse primeiro serviço como `backend`**

No serviço criado automaticamente: abra **Settings** → renomeie o serviço para `backend` → em **Source**, defina **Root Directory** como `backend`.

Expected: um novo deploy é disparado automaticamente usando `backend/Dockerfile`.

- [ ] **Step 4: Adicionar o PostgreSQL**

No canvas do projeto, clique **+ New** → **Database** → **Add PostgreSQL**.

Expected: um serviço `Postgres` aparece no projeto, com uma variável `DATABASE_URL` disponível internamente para outros serviços referenciarem.

---

## Task 4: Configurar e publicar o serviço `backend`

**Interfaces:**
- Consumes: serviço `backend` e `Postgres` criados na Task 3.
- Produces: URL pública HTTPS do backend (ex: `https://backend-production-xxxx.up.railway.app`), usada pelo frontend na Task 5 (`VITE_API_URL`) e nas validações desta task.

- [ ] **Step 1: Gerar um `SECRET_KEY` de produção**

Rode localmente (qualquer um dos dois):

```bash
openssl rand -hex 32
```

ou

```bash
python -c "import secrets; print(secrets.token_hex(32))"
```

Guarde o valor gerado — vai ser colado na variável de ambiente no próximo passo.

- [ ] **Step 2: Configurar as variáveis de ambiente do `backend`**

No serviço `backend`, aba **Variables**, adicione:

| Nome | Valor |
|---|---|
| `DATABASE_URL` | `${{Postgres.DATABASE_URL}}` (o Railway autocompleta essa referência ao digitar `${{`) |
| `SECRET_KEY` | o valor gerado no Step 1 |
| `BACKEND_CORS_ORIGINS` | `*` (temporário — corrigido na Task 6) |

- [ ] **Step 3: Configurar o healthcheck**

Aba **Settings** → **Deploy** → **Healthcheck Path** → `/health`.

- [ ] **Step 4: Gerar o domínio público**

Aba **Settings** → **Networking** → **Generate Domain**.

Expected: uma URL pública é gerada (ex: `https://backend-production-xxxx.up.railway.app`). Anote-a — vai ser usada nas Tasks 5 e 6.

- [ ] **Step 5: Confirmar o deploy**

Aba **Deployments**: o build mais recente deve terminar com status verde ("Success").

- [ ] **Step 6: Validar o healthcheck publicamente**

```bash
curl -s https://<url-backend>/health
```

Expected: `{"status":"healthy"}`.

---

## Task 5: Configurar e publicar o serviço `frontend`

**Interfaces:**
- Consumes: URL pública do `backend` (Task 4).
- Produces: URL pública HTTPS do frontend (ex: `https://frontend-production-xxxx.up.railway.app`), usada na Task 6 (CORS) e na Task 7 (validação end-to-end).

- [ ] **Step 1: Criar o segundo serviço a partir do mesmo repositório**

No projeto Railway, clique **+ New** → **GitHub Repo** → selecione `joaoPCarv4lho/finance_app` novamente.

Expected: um novo serviço é criado no mesmo projeto, também apontando para a raiz do repo.

- [ ] **Step 2: Configurar como `frontend`**

Renomeie o serviço para `frontend` (**Settings** → topo). Em **Settings** → **Source**, defina **Root Directory** como `frontend`.

- [ ] **Step 3: Configurar `VITE_API_URL`**

Aba **Variables**, adicione:

| Nome | Valor |
|---|---|
| `VITE_API_URL` | `https://<url-backend-da-task-4>/api/v1` |

Importante: essa variável precisa estar setada **antes** do build rodar (o Vite embute o valor no bundle estático em build-time). Como acabamos de criar o serviço, ainda não houve build — o primeiro build já vai pegar o valor certo.

- [ ] **Step 4: Confirmar o start command**

O Nixpacks detecta automaticamente o script `start` de `frontend/package.json` (adicionado na Task 2) e usa `npm start`. Depois do primeiro deploy, confira em **Deployments** → build log se ele rodou `serve -s dist`. Se em vez disso ele tentar `vite preview`, defina manualmente em **Settings** → **Deploy** → **Custom Start Command**: `npm start`.

- [ ] **Step 5: Gerar o domínio público**

Aba **Settings** → **Networking** → **Generate Domain**.

Expected: uma URL pública é gerada (ex: `https://frontend-production-xxxx.up.railway.app`). Anote-a.

- [ ] **Step 6: Confirmar o deploy**

Aba **Deployments**: build mais recente com status verde.

- [ ] **Step 7: Validar que a página carrega**

Abra a URL do frontend no navegador.

Expected: a tela de login carrega (login/cadastro em si ainda pode falhar por causa do CORS — corrigido na Task 6).

---

## Task 6: Fechar o loop de CORS

**Interfaces:**
- Consumes: URL pública do `frontend` (Task 5).
- Produces: `backend` aceitando requisições apenas da origem do frontend de produção.

- [ ] **Step 1: Atualizar `BACKEND_CORS_ORIGINS`**

No serviço `backend`, aba **Variables**, edite `BACKEND_CORS_ORIGINS` de `*` para a URL exata do frontend (sem barra `/` no final), ex:

```
https://frontend-production-xxxx.up.railway.app
```

- [ ] **Step 2: Confirmar o redeploy**

Editar uma variável reinicia o serviço automaticamente (sem rebuild da imagem Docker). Aba **Deployments** do `backend`: confirme que o novo deploy termina verde.

- [ ] **Step 3: Validar CORS no navegador**

Abra a URL do frontend, abra o DevTools (aba Network e Console), tente cadastrar um usuário de teste.

Expected: nenhum erro de CORS no console; a chamada `POST` para `/api/v1/auth/register` retorna `201`.

---

## Task 7: Validação end-to-end pós-deploy

**Interfaces:**
- Consumes: `backend` e `frontend` publicados e com CORS fechado (Tasks 4–6).

- [ ] **Step 1: Healthcheck**

```bash
curl -s https://<url-backend>/health
```

Expected: `{"status":"healthy"}`.

- [ ] **Step 2: Cadastro e login**

No frontend publicado: cadastre um usuário novo em `/register`, confirme redirecionamento para a área autenticada (dashboard ou onboarding).

- [ ] **Step 3: Transação**

Lance uma transação (Entrada, qualquer valor) pelo botão **+ Lançar**. Confirme que ela aparece no resumo do dashboard e em `/transactions`.

- [ ] **Step 4: Meta**

Crie uma meta em `/goals`, com valor-alvo e data-alvo. Confirme que ela aparece com a barra de progresso.

- [ ] **Step 5: HTTPS**

Confirme (ícone de cadeado do navegador) que tanto a URL do frontend quanto a do backend carregam em HTTPS, sem avisos de certificado.

- [ ] **Step 6: Confirmar deploy automático (CI/CD)**

Faça um commit trivial (ex: um ajuste de comentário ou texto) em `main`, dê `git push`, e confirme nas abas **Deployments** dos dois serviços (`backend` e/ou `frontend`, dependendo do que mudou) que um novo deploy dispara sozinho, sem ação manual no dashboard.

---

## Self-Review (executado pelo autor do plano)

- **Cobertura do spec:** arquitetura (Task 3–5), mudança de `DATABASE_URL` (Task 1), mudança do servidor de produção do frontend (Task 2), variáveis de ambiente (Tasks 4–6), ordem do deploy com o loop de CORS (Tasks 3→4→5→6, na mesma sequência do spec), validação pós-deploy (Task 7), segurança — `SECRET_KEY` gerado e `BACKEND_CORS_ORIGINS` restrito (Tasks 4 e 6) — todos cobertos.
- **Placeholders:** nenhum "TBD"/"adicionar validação apropriada" — toda variável, comando e trecho de código está por extenso.
- **Consistência de nomes:** `DATABASE_URL`, `SECRET_KEY`, `BACKEND_CORS_ORIGINS`, `VITE_API_URL` usados de forma idêntica em todas as tasks que os referenciam; nomes dos serviços (`backend`, `frontend`, `Postgres`) consistentes do Task 3 ao 7.
