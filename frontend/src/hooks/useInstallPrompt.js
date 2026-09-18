import { useEffect, useState } from 'react'

function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)')?.matches ||
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
