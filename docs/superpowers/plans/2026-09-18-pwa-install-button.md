# Botão de Instalação do App (PWA) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Permitir que o usuário instale o app ("Meu Bolso") na tela inicial do celular (ou como app de desktop no Chrome) a partir de um botão dentro do próprio app, sem adicionar funcionamento offline.

**Architecture:** Infraestrutura estática de PWA (manifest + ícones + service worker mínimo, sem cache) em `frontend/public/`, um hook `useInstallPrompt` que encapsula toda a lógica de detecção de plataforma (Chrome/Android com prompt nativo, iOS com instruções manuais, já instalado, ou sem suporte), e um card `InstallAppCard` na tela de Perfil que consome o hook e decide o que mostrar.

**Tech Stack:** React 18 + Vite 5 (já existentes), `lucide-react` (ícones, já existente), Vitest + `@testing-library/react` + `jsdom` (novos, só para testar o hook), `sharp` (usado uma única vez, fora do projeto, só para gerar os PNGs dos ícones — não vira dependência do projeto).

**Spec:** `docs/superpowers/specs/2026-09-18-pwa-install-button-design.md`

## Global Constraints

- Sem cache/funcionamento offline — o service worker não intercepta nem cacheia nada (spec, seção "Arquitetura", item 2).
- `theme_color` do manifest deve usar o verde já estabelecido no app: `#059669` (já é o `theme-color` em `frontend/index.html`). `background_color` é intencionalmente `#ffffff` (branco) — usado só na splash screen do Android durante o carregamento, e o app em si é claro por padrão; um verde ali ficaria pior que branco. (Nota adicionada após a revisão final encontrar essa linha contradizendo o Step 4 da Task 1, que já usava `#ffffff` desde o início — a Task 1 estava certa, esta linha é que estava redigida errado.)
- O card `InstallAppCard` não deve renderizar nada (`return null`) quando não há nada acionável a oferecer (app já instalado, ou navegador sem suporte a nenhum dos dois caminhos) — spec, seção "UI".
- Ícones gerados programaticamente (não depender de fonte de emoji do sistema) — spec, seção "Ícones".

---

## Task 1: Ícones, manifest e service worker

**Files:**
- Create: `frontend/public/icons/icon-192.png`
- Create: `frontend/public/icons/icon-512.png`
- Create: `frontend/public/manifest.webmanifest`
- Create: `frontend/public/sw.js`
- Modify: `frontend/index.html`
- Modify: `frontend/src/main.jsx`

**Interfaces:**
- Produces: `/manifest.webmanifest`, `/sw.js`, `/icons/icon-192.png`, `/icons/icon-512.png` servidos como arquivos estáticos na raiz do build (Vite copia `frontend/public/**` para a raiz de `dist/` sem processamento). Nenhuma outra task depende de símbolos deste — só dos arquivos existirem nesses caminhos exatos.

- [ ] **Step 1: Gerar os dois PNGs do ícone num diretório temporário fora do repositório**

Este projeto não tem nenhuma ferramenta de geração de imagem instalada (sem ImageMagick, sem Pillow, sem `sharp` global). Instale `sharp` temporariamente **fora do repositório** (nunca dentro de `frontend/`, para não tocar em `package.json`/`package-lock.json`):

```bash
SCRATCH=$(mktemp -d)
cd "$SCRATCH"
npm init -y >/dev/null 2>&1
npm install sharp --no-save
```

- [ ] **Step 2: Escrever e rodar o script de geração**

Crie `$SCRATCH/gen.mjs` com este conteúdo exato:

```js
import sharp from 'sharp'

const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 512 512">
  <rect width="512" height="512" fill="#059669"/>
  <rect x="96" y="160" width="320" height="220" rx="28" fill="#ffffff"/>
  <rect x="96" y="160" width="320" height="70" rx="28" fill="#047857"/>
  <circle cx="352" cy="270" r="26" fill="#059669"/>
</svg>`

await sharp(Buffer.from(svg)).resize(512, 512).png().toFile('icon-512.png')
await sharp(Buffer.from(svg)).resize(192, 192).png().toFile('icon-192.png')

for (const f of ['icon-512.png', 'icon-192.png']) {
  const meta = await sharp(f).metadata()
  console.log(f, meta.width, meta.height, meta.format)
}
```

Rode:

```bash
node gen.mjs
```

Expected: imprime exatamente
```
icon-512.png 512 512 png
icon-192.png 192 192 png
```
(Este é o desenho de uma carteira simples: fundo verde, corpo branco, faixa/aba verde-escura no topo, e um círculo verde representando o fecho. Já foi testado e o resultado visual confirmado antes de escrever este plano.)

- [ ] **Step 3: Copiar os PNGs gerados para o repositório**

A partir da raiz do repositório (o diretório de trabalho onde `frontend/` existe):

```bash
mkdir -p frontend/public/icons
cp "$SCRATCH/icon-512.png" frontend/public/icons/icon-512.png
cp "$SCRATCH/icon-192.png" frontend/public/icons/icon-192.png
```

- [ ] **Step 4: Criar o manifest**

Crie `frontend/public/manifest.webmanifest`:

```json
{
  "name": "Meu Bolso — Finanças Simples",
  "short_name": "Meu Bolso",
  "description": "Controle suas finanças pessoais: teto de gastos e metas de investimento.",
  "start_url": "/",
  "scope": "/",
  "display": "standalone",
  "background_color": "#ffffff",
  "theme_color": "#059669",
  "icons": [
    { "src": "/icons/icon-192.png", "sizes": "192x192", "type": "image/png" },
    { "src": "/icons/icon-512.png", "sizes": "512x512", "type": "image/png" }
  ]
}
```

- [ ] **Step 5: Criar o service worker mínimo**

Crie `frontend/public/sw.js`:

```js
// Service worker mínimo: existe apenas para satisfazer o critério de
// instalabilidade do Chrome (exige um service worker ativo). Não
// intercepta nem cacheia nada — o app continua exigindo rede.
self.addEventListener('fetch', () => {})
```

- [ ] **Step 6: Registrar o manifest no `index.html`**

Em `frontend/index.html`, logo após a linha `<meta name="theme-color" content="#059669" />` (linha 7), adicione:

```html
    <link rel="manifest" href="/manifest.webmanifest" />
```

- [ ] **Step 7: Registrar o service worker em `main.jsx`**

No final de `frontend/src/main.jsx`, depois da chamada `ReactDOM.createRoot(...).render(...)`, adicione:

```jsx
if ('serviceWorker' in navigator) {
  window.addEventListener('load', () => {
    navigator.serviceWorker.register('/sw.js').catch(() => {})
  })
}
```

- [ ] **Step 8: Verificar que o build inclui os novos arquivos**

```bash
cd frontend
npm run build
ls dist/manifest.webmanifest dist/sw.js dist/icons/icon-192.png dist/icons/icon-512.png
```

Expected: os 4 caminhos listados sem erro "No such file or directory".

- [ ] **Step 9: Commit**

```bash
git add frontend/public/icons/icon-192.png frontend/public/icons/icon-512.png frontend/public/manifest.webmanifest frontend/public/sw.js frontend/index.html frontend/src/main.jsx
git commit -m "feat(frontend): adiciona manifest, ícones e service worker mínimo (infra PWA)"
```

---

## Task 2: Hook `useInstallPrompt`

**Files:**
- Create: `frontend/src/hooks/useInstallPrompt.js`
- Test: `frontend/src/hooks/useInstallPrompt.test.js`
- Modify: `frontend/package.json` (devDependencies + script)
- Modify: `frontend/vite.config.js`

**Interfaces:**
- Produces: `useInstallPrompt()` (default export nomeado, `frontend/src/hooks/useInstallPrompt.js`) retornando `{ canInstall: boolean, isIOS: boolean, promptInstall: () => Promise<void> }`. Usado pela Task 3 (`InstallAppCard`) exatamente com esses três nomes de campo.

- [ ] **Step 1: Adicionar Vitest e dependências de teste**

Edite `frontend/package.json`: adicione `"test": "vitest run"` em `scripts`, e em `devDependencies` adicione `"vitest": "^2.1.0"`, `"jsdom": "^25.0.0"`, `"@testing-library/react": "^16.0.0"` (mantendo `@vitejs/plugin-react` e `vite` como já estão).

```bash
cd frontend
npm install
```

- [ ] **Step 2: Configurar o ambiente de teste no `vite.config.js`**

Edite `frontend/vite.config.js`, adicionando um bloco `test` ao objeto retornado por `defineConfig` (mantendo `plugins` e `server` exatamente como já estão):

```js
  test: {
    environment: 'jsdom',
  },
```

- [ ] **Step 3: Escrever o teste que falha**

Crie `frontend/src/hooks/useInstallPrompt.test.js`:

```js
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'
import { useInstallPrompt } from './useInstallPrompt'

let matchesStandalone

beforeEach(() => {
  matchesStandalone = false
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: query === '(display-mode: standalone)' ? matchesStandalone : false,
    media: query,
    addListener: () => {},
    removeListener: () => {},
  }))
  Object.defineProperty(window.navigator, 'standalone', {
    value: undefined,
    configurable: true,
  })
  Object.defineProperty(window.navigator, 'userAgent', {
    value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0 Safari/537.36',
    configurable: true,
  })
})

afterEach(() => {
  cleanup()
})

function fireBeforeInstallPrompt() {
  const event = new Event('beforeinstallprompt', { cancelable: true })
  event.prompt = vi.fn()
  event.userChoice = Promise.resolve({ outcome: 'accepted' })
  window.dispatchEvent(event)
  return event
}

describe('useInstallPrompt', () => {
  it('exposes canInstall after beforeinstallprompt fires, and clears it after promptInstall()', async () => {
    const { result } = renderHook(() => useInstallPrompt())
    expect(result.current.canInstall).toBe(false)

    let event
    act(() => {
      event = fireBeforeInstallPrompt()
    })
    expect(result.current.canInstall).toBe(true)
    expect(event.prompt).not.toHaveBeenCalled()

    await act(async () => {
      await result.current.promptInstall()
    })
    expect(event.prompt).toHaveBeenCalledTimes(1)
    expect(result.current.canInstall).toBe(false)
  })

  it('detects iOS when no beforeinstallprompt is available and the app is not installed', () => {
    Object.defineProperty(window.navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      configurable: true,
    })
    const { result } = renderHook(() => useInstallPrompt())
    expect(result.current.isIOS).toBe(true)
    expect(result.current.canInstall).toBe(false)
  })

  it('offers nothing when the app is already installed (standalone), even on iOS', () => {
    matchesStandalone = true
    Object.defineProperty(window.navigator, 'userAgent', {
      value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
      configurable: true,
    })
    const { result } = renderHook(() => useInstallPrompt())
    expect(result.current.canInstall).toBe(false)
    expect(result.current.isIOS).toBe(false)
  })

  it('offers nothing on platforms with neither the native prompt nor iOS (e.g. desktop Firefox)', () => {
    Object.defineProperty(window.navigator, 'userAgent', {
      value: 'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0',
      configurable: true,
    })
    const { result } = renderHook(() => useInstallPrompt())
    expect(result.current.canInstall).toBe(false)
    expect(result.current.isIOS).toBe(false)
  })
})
```

- [ ] **Step 4: Rodar os testes e confirmar que falham**

```bash
cd frontend
npm test
```

Expected: FAIL — o módulo `./useInstallPrompt` ainda não existe (`Failed to resolve import`).

- [ ] **Step 5: Implementar o hook**

Crie `frontend/src/hooks/useInstallPrompt.js`:

```js
import { useEffect, useState } from 'react'

function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)').matches ||
    window.navigator.standalone === true
  )
}

function isIOSDevice() {
  return /iphone|ipad|ipod/i.test(window.navigator.userAgent)
}

/**
 * Expõe se/como o app pode ser instalado neste dispositivo:
 * - `canInstall: true` + `promptInstall()` no Chrome/Edge (prompt nativo)
 * - `isIOS: true` no Safari do iOS (sem API de prompt nativo; quem chama
 *   o hook deve mostrar instruções manuais)
 * - ambos `false` quando o app já está instalado ou a plataforma não
 *   oferece nenhum caminho de instalação
 */
export function useInstallPrompt() {
  const [deferredPrompt, setDeferredPrompt] = useState(null)
  const [installed, setInstalled] = useState(isStandalone())

  useEffect(() => {
    if (installed) return

    function onBeforeInstallPrompt(e) {
      e.preventDefault()
      setDeferredPrompt(e)
    }
    function onAppInstalled() {
      setInstalled(true)
      setDeferredPrompt(null)
    }

    window.addEventListener('beforeinstallprompt', onBeforeInstallPrompt)
    window.addEventListener('appinstalled', onAppInstalled)
    return () => {
      window.removeEventListener('beforeinstallprompt', onBeforeInstallPrompt)
      window.removeEventListener('appinstalled', onAppInstalled)
    }
  }, [installed])

  async function promptInstall() {
    if (!deferredPrompt) return
    deferredPrompt.prompt()
    await deferredPrompt.userChoice
    setDeferredPrompt(null)
  }

  return {
    canInstall: !installed && deferredPrompt !== null,
    isIOS: !installed && deferredPrompt === null && isIOSDevice(),
    promptInstall,
  }
}
```

- [ ] **Step 6: Rodar os testes e confirmar que passam**

```bash
cd frontend
npm test
```

Expected: PASS (4 testes, todos verdes, sem warnings).

- [ ] **Step 7: Commit**

```bash
git add frontend/package.json frontend/package-lock.json frontend/vite.config.js frontend/src/hooks/useInstallPrompt.js frontend/src/hooks/useInstallPrompt.test.js
git commit -m "feat(frontend): adiciona hook useInstallPrompt com testes"
```

---

## Task 3: Componente `InstallAppCard` e integração em Perfil

**Files:**
- Create: `frontend/src/components/InstallAppCard.jsx`
- Modify: `frontend/src/pages/Settings.jsx`

**Interfaces:**
- Consumes: `useInstallPrompt()` de `frontend/src/hooks/useInstallPrompt.js` (Task 2), retornando `{ canInstall, isIOS, promptInstall }`. Consome também `Modal` (default export) de `frontend/src/components/Modal.jsx` (já existe, sem mudanças).
- Produces: `InstallAppCard` (default export, `frontend/src/components/InstallAppCard.jsx`), sem props — usado diretamente dentro de `Settings.jsx`.

- [ ] **Step 1: Criar o componente**

Crie `frontend/src/components/InstallAppCard.jsx`:

```jsx
import { useState } from 'react'
import { Smartphone, Download, Share } from 'lucide-react'
import { useInstallPrompt } from '../hooks/useInstallPrompt'
import Modal from './Modal.jsx'

export default function InstallAppCard() {
  const { canInstall, isIOS, promptInstall } = useInstallPrompt()
  const [showIOSInstructions, setShowIOSInstructions] = useState(false)

  if (!canInstall && !isIOS) return null

  return (
    <div className="card mt-16">
      <h2 className="card-title">
        <Smartphone size={18} /> Instalar app
      </h2>
      <p className="muted" style={{ fontSize: '0.85rem' }}>
        Acesse mais rápido, direto da tela inicial do seu celular.
      </p>
      <button
        className="btn mt-16"
        onClick={canInstall ? promptInstall : () => setShowIOSInstructions(true)}
      >
        <Download size={17} /> Instalar no celular
      </button>

      {showIOSInstructions && (
        <Modal
          title="Instalar no iPhone/iPad"
          onClose={() => setShowIOSInstructions(false)}
        >
          <p>Para instalar o Meu Bolso na tela inicial:</p>
          <ol>
            <li>
              Toque no ícone de Compartilhar{' '}
              <Share size={15} style={{ verticalAlign: 'middle' }} /> na barra
              do Safari.
            </li>
            <li>Escolha "Adicionar à Tela de Início".</li>
          </ol>
        </Modal>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Integrar em `Settings.jsx`**

Em `frontend/src/pages/Settings.jsx`, adicione o import junto aos outros (após a linha `import { formatCurrency } from '../utils/format'`, linha 16):

```jsx
import InstallAppCard from '../components/InstallAppCard.jsx'
```

Insira `<InstallAppCard />` entre o card de "Aparência" (que termina na linha 168 com `</div>`) e o botão "Sair da conta" (linha 170), assim:

```jsx
      </div>

      <InstallAppCard />

      <button className="btn secondary mt-16" style={{ color: 'var(--expense)' }} onClick={logout}>
```

- [ ] **Step 3: Verificar visualmente com build local**

```bash
cd frontend
npm run build
npm run dev
```

Abra `http://localhost:5173` no navegador, faça login (ou cadastre um usuário de teste), vá em Perfil. Confirme que a tela carrega sem erros no console — o card de "Instalar app" pode ou não aparecer nesse momento (depende do navegador decidir que o app é instalável, o que não é garantido em `localhost` durante `npm run dev`); o importante aqui é confirmar que não há erro de JavaScript nem quebra de layout. Pare o servidor (Ctrl+C) depois de confirmar.

- [ ] **Step 4: Commit**

```bash
git add frontend/src/components/InstallAppCard.jsx frontend/src/pages/Settings.jsx
git commit -m "feat(frontend): adiciona card de instalação do app em Perfil"
```

---

## Task 4: Build de produção e validação via navegador

**Files:**
- Nenhum arquivo novo — task de verificação.

**Interfaces:**
- Consumes: tudo das Tasks 1-3 (manifest, ícones, service worker, hook, componente integrado).

Esta task valida o fluxo completo servindo o build de produção localmente
(o mesmo mecanismo usado no Railway: `serve -s dist`), usando automação de
navegador (ferramentas `mcp__claude-in-chrome__*` — carregue-as via
`ToolSearch` se ainda não estiverem carregadas, com a query
`"select:mcp__claude-in-chrome__tabs_context_mcp,mcp__claude-in-chrome__navigate,mcp__claude-in-chrome__computer,mcp__claude-in-chrome__read_page,mcp__claude-in-chrome__tabs_create_mcp,mcp__claude-in-chrome__tabs_close_mcp,mcp__claude-in-chrome__javascript_tool,mcp__claude-in-chrome__read_console_messages"`).
Não valida contra produção (Railway) para manter esta task inteiramente
autônoma nesta sessão — validar em produção depois do deploy é uma
recomendação final, não um passo bloqueante deste plano.

**Nota sobre limitação de automação:** o Chrome usa heurísticas de
engajamento do usuário para decidir quando emitir o evento real
`beforeinstallprompt`; isso não é reproduzível de forma determinística via
automação. Por isso o caminho do prompt nativo (Chrome/Android) é validado
aqui **simulando o evento via `javascript_tool`** (`window.dispatchEvent`) em
vez de esperar o navegador emiti-lo sozinho — isso confirma que a lógica do
app reage corretamente ao evento, o que é o que este código controla; o
prompt nativo em si (a caixa de diálogo do sistema operacional) só pode ser
verificado de fato num Android real, fora do alcance desta automação.

- [ ] **Step 1: Buildar e subir o servidor de produção localmente**

```bash
cd frontend
npm run build
PORT=4180 npm start &
sleep 2
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4180
```

Expected: `200`.

- [ ] **Step 2: Verificar o manifest servido**

```bash
curl -s http://localhost:4180/manifest.webmanifest
```

Expected: JSON válido contendo `"short_name": "Meu Bolso"` e os dois ícones em `/icons/icon-192.png` e `/icons/icon-512.png`.

```bash
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4180/icons/icon-192.png
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4180/icons/icon-512.png
curl -s -o /dev/null -w "%{http_code}\n" http://localhost:4180/sw.js
```

Expected: `200` para os três.

- [ ] **Step 3: Login e navegação até Perfil via navegador**

Use as ferramentas `mcp__claude-in-chrome__*` para: abrir uma nova aba em
`http://localhost:4180`, cadastrar um usuário de teste (ou logar num já
existente), navegar até `/settings`. Use `read_console_messages` para
confirmar que não há erros no console (o registro do service worker deve
aparecer sem erro).

- [ ] **Step 4: Verificar o registro do service worker**

Com `javascript_tool`, rode nesta página:

```js
navigator.serviceWorker.getRegistrations().then(regs => regs.map(r => r.active?.scriptURL))
```

Expected: retorna um array contendo uma URL terminando em `/sw.js`.

- [ ] **Step 5: Validar o caminho iOS (instruções manuais)**

Com `javascript_tool`, sobrescreva o `userAgent` e recarregue a página (via
`navigate`) para simular um iPhone — como `navigator.userAgent` não é
gravável diretamente, use `Object.defineProperty`:

```js
Object.defineProperty(window.navigator, 'userAgent', {
  value: 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15',
  configurable: true,
})
```

Rode isso, depois use `computer`/`read_page` para: confirmar que o card
"Instalar app" aparece em `/settings`, clicar em "Instalar no celular",
confirmar que abre o modal "Instalar no iPhone/iPad" com o texto sobre
"Adicionar à Tela de Início", e fechar o modal.

- [ ] **Step 6: Validar o caminho Chrome/Android (prompt simulado)**

Recarregue a página (sem o UA de iPhone, ou em uma aba nova) e, com
`javascript_tool`, dispare um evento sintético de instalabilidade:

```js
const ev = new Event('beforeinstallprompt', { cancelable: true })
ev.prompt = () => { window.__promptCalled = true }
ev.userChoice = Promise.resolve({ outcome: 'accepted' })
window.dispatchEvent(ev)
```

Depois, com `read_page`/`computer`: confirmar que o card "Instalar app"
aparece em `/settings`, clicar em "Instalar no celular", e então com
`javascript_tool` verificar `window.__promptCalled === true` (confirma que
o clique chamou `deferredPrompt.prompt()` de fato). Confirmar também que,
depois do clique, o card desaparece (já que `canInstall` volta a `false`
após `promptInstall()`).

- [ ] **Step 7: Encerrar o servidor local**

```bash
kill %1
```

- [ ] **Step 8: Reportar resultado**

Nenhum commit nesta task (é só verificação). Se qualquer passo falhar,
volte à task correspondente (1, 2 ou 3), corrija, re-rode os testes daquela
task, e repita esta Task 4 do Step 1 em diante.

---

## Self-Review (executado pelo autor do plano)

- **Cobertura do spec:** manifest+ícones+service worker (Task 1), lógica de
  detecção de plataforma via hook testado (Task 2), UI condicional com
  fallback iOS via modal reaproveitado (Task 3), validação end-to-end
  incluindo a limitação documentada sobre `beforeinstallprompt` não ser
  100% reproduzível via automação (Task 4) — todos os itens do spec têm
  uma task correspondente.
- **Placeholders:** nenhum "TBD"/"adicionar lógica apropriada" — todo
  código, JSON e comandos estão por extenso, incluindo o script de geração
  dos ícones (testado e com output esperado documentado).
- **Consistência de nomes:** `useInstallPrompt` retorna
  `{ canInstall, isIOS, promptInstall }` na Task 2 e é consumido com
  exatamente esses três nomes na Task 3; caminhos `/manifest.webmanifest`,
  `/sw.js`, `/icons/icon-192.png`, `/icons/icon-512.png` idênticos entre
  Task 1 (onde são criados) e Task 4 (onde são verificados).
- **Paralelização:** Tasks 1 e 2 não compartilham nenhum arquivo e não têm
  dependência de interface entre si — são candidatas a execução paralela
  em worktrees isolados, se o executor optar por isso. Task 3 depende da
  Task 2; Task 4 depende de todas.
