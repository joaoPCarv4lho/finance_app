import { useSyncExternalStore } from 'react'
import { getSnapshot, subscribe, promptInstall } from './installPromptStore'

function isIOSDevice() {
  const ua = window.navigator.userAgent
  return (
    /iphone|ipad|ipod/i.test(ua) ||
    (/macintosh/i.test(ua) && window.navigator.maxTouchPoints > 1)
  )
}

/**
 * Exposes se/como o app pode ser instalado neste dispositivo:
 * - `canInstall: true` + `promptInstall()` no Chrome/Edge (prompt nativo)
 * - `isIOS: true` no Safari do iOS/iPadOS (sem API de prompt nativo; quem
 *   chama o hook deve mostrar instruções manuais)
 * - ambos `false` quando o app já está instalado ou a plataforma não
 *   oferece nenhum caminho de instalação
 *
 * A captura do evento beforeinstallprompt vive em `installPromptStore.js`
 * (singleton de módulo, importado uma vez em main.jsx), não neste hook —
 * assim nenhum componente precisa estar montado para o evento ser
 * capturado.
 */
export function useInstallPrompt() {
  const { deferredPrompt, installed } = useSyncExternalStore(subscribe, getSnapshot)

  return {
    canInstall: !installed && deferredPrompt !== null,
    isIOS: !installed && deferredPrompt === null && isIOSDevice(),
    promptInstall,
  }
}
