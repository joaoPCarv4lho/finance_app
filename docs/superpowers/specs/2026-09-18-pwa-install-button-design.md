# Botão de instalação do app (PWA instalável)

**Data:** 2026-09-18
**Status:** Aprovado

## Contexto

O frontend ("Meu Bolso") é um SPA React/Vite servido como build estático
(`frontend/`, deploy no Railway via `serve`). Não existe nenhuma
infraestrutura de PWA hoje: sem `manifest.webmanifest`, sem service worker,
sem ícones de app (só um favicon SVG inline no `index.html`). O objetivo é
permitir que o usuário instale o app na tela inicial do celular (ou como app
de desktop no Chrome), a partir de um botão dentro do próprio app.

## Objetivo

Adicionar a capacidade de instalação (Add to Home Screen / instalação PWA)
com um botão visível no app, sem introduzir funcionamento offline.

Fora de escopo, deliberadamente: cache de assets/dados para uso offline,
sincronização em background, notificações push, ícones "premium"
desenhados por um designer (usamos um ícone simples gerado
programaticamente, substituível depois sem tocar em código).

## Arquitetura

1. **Manifest** (`frontend/public/manifest.webmanifest`) — metadados do
   app (nome, ícones, cores, `display: "standalone"`) que o navegador lê
   para decidir se o app é instalável e como ele aparece instalado.
2. **Service worker mínimo** (`frontend/public/sw.js`) — só um listener de
   `fetch` vazio (nunca intercepta nem cacheia nada). Existe unicamente
   porque o Chrome exige um service worker ativo como pré-requisito de
   instalabilidade; não implementa nenhum comportamento offline.
3. **Hook `useInstallPrompt`** (`frontend/src/hooks/useInstallPrompt.js`) —
   encapsula toda a lógica específica de plataforma (ver "Comportamento por
   plataforma" abaixo) e expõe uma interface única para a UI.
4. **Componente `InstallAppCard`**
   (`frontend/src/components/InstallAppCard.jsx`) — card visual, renderizado
   dentro de `Settings.jsx`, que consome o hook e decide o que mostrar (nada,
   botão de instalar, ou instruções do iOS).

Vite copia tudo que está em `frontend/public/` para a raiz do `dist/` sem
processamento — por isso o manifest e o service worker vivem lá, e são
referenciados/registrados com caminhos absolutos (`/manifest.webmanifest`,
`/sw.js`).

## Comportamento por plataforma

O navegador é quem decide se/quando oferece instalação — o app não pode
forçar isso, só reagir:

- **Chrome/Edge (Android e desktop):** dispara o evento
  `beforeinstallprompt` quando decide que o app atende aos critérios de
  instalabilidade (manifest válido + service worker + servido via HTTPS,
  já garantido pelo Railway). O hook captura esse evento com
  `e.preventDefault()`, guarda a referência, e a UI mostra um botão. Ao
  clicar, chama `deferredPrompt.prompt()` e aguarda `userChoice`; depois
  descarta a referência (só pode ser usada uma vez) e esconde o botão. Um
  listener do evento `appinstalled` também esconde o botão, cobrindo o
  caso de o usuário instalar por outro caminho (menu do navegador).
- **iOS Safari:** não implementa `beforeinstallprompt` — não existe API
  para disparar o prompt programaticamente. O hook detecta iOS via
  `navigator.userAgent` e expõe `isIOS: true`. Nesse caso o botão abre um
  modal (reaproveitando `Modal.jsx`) com instruções: "Toque em Compartilhar
  (□↑) na barra do Safari e depois em 'Adicionar à Tela de Início'".
- **App já instalado:** detectado via
  `window.matchMedia('(display-mode: standalone)').matches` (Android/desktop)
  ou `navigator.standalone` (iOS). Nesse caso o hook não expõe nada
  acionável e o card não renderiza.
- **Navegadores sem suporte a nenhum dos dois** (ex: Firefox desktop): nem
  `beforeinstallprompt` dispara nem é iOS — o card não renderiza. Não há
  nada de útil a oferecer nesses casos.

## Ícones

Não existe hoje nenhum asset de ícone além do favicon SVG inline. Serão
gerados dois PNGs simples (192×192 e 512×512, fundo verde `#059669` — a
cor já usada como `theme-color` — com um glifo de carteira em branco
desenhado via formas geométricas, sem depender de fonte de emoji do
sistema) e salvos em `frontend/public/icons/`. É um ícone placeholder,
visualmente simples mas coerente com a paleta do app; pode ser trocado
depois substituindo só os arquivos PNG, sem mudanças de código.

## UI — `InstallAppCard`

Novo card em `Settings.jsx`, inserido entre o card de "Aparência" e o
botão de "Sair da conta", seguindo exatamente o padrão visual dos outros
cards da tela (`<div className="card mt-16">`, `<h2 className="card-title">`
com ícone do `lucide-react`). Título "Instalar app", texto curto
explicando o benefício ("Acesse mais rápido, direto da tela inicial"),
botão "Instalar no celular". Quando o hook não expõe nada acionável, o
componente retorna `null` (não renderiza nada, sem espaço vazio).

## Testes

Projeto frontend não tem suíte automatizada hoje. Escopo de testes deste
spec:

- **Vitest** (novo, adicionado como dependência de desenvolvimento) para o
  hook `useInstallPrompt`: mock do evento `beforeinstallprompt` (captura,
  `prompt()` chamado ao instalar, estado limpo depois), detecção de iOS via
  `navigator.userAgent` mockado, detecção de app já instalado via
  `matchMedia` mockado, e o caso "nenhum dos dois" (nada exposto).
- **Validação manual/automação de navegador (`claude-in-chrome`) contra o
  app publicado em produção**
  (`https://frontend-production-e873.up.railway.app`): manifest acessível
  e válido (`GET /manifest.webmanifest`), ícones respondem 200
  (`GET /icons/icon-192.png`, `icon-512.png`), service worker registra sem
  erro no console, o card aparece em `/settings` para uma conta de teste,
  e — simulando um `User-Agent` de iPhone — o fluxo abre o modal de
  instruções do iOS corretamente.
- **Fora do alcance de automação, documentado como limitação:** o Chrome
  usa heurísticas de engajamento do usuário para decidir quando de fato
  disparar `beforeinstallprompt` em produção; isso não é 100% reproduzível
  de forma determinística via automação. O prompt nativo completo (tocar
  "Instalar" e ver o app aparecer na tela inicial de um Android real) fica
  como verificação manual recomendada ao usuário após a entrega.
