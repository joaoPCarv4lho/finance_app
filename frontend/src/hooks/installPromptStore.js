// Module-level singleton, imported once (for its side effect) from
// main.jsx before React mounts. Chrome fires `beforeinstallprompt`
// shortly after page load, regardless of which route is active — a
// listener registered inside a component's useEffect (the previous
// approach) only exists once that component mounts, which is too late
// if the event fires before the user has navigated there. Listening at
// module scope means the event is captured no matter what's on screen.

function isStandalone() {
  return (
    window.matchMedia?.('(display-mode: standalone)')?.matches ||
    window.navigator.standalone === true
  )
}

let snapshot = { deferredPrompt: null, installed: isStandalone() }
const listeners = new Set()

function setSnapshot(patch) {
  snapshot = { ...snapshot, ...patch }
  listeners.forEach((listener) => listener())
}

if (typeof window !== 'undefined' && !snapshot.installed) {
  window.addEventListener('beforeinstallprompt', (e) => {
    e.preventDefault()
    setSnapshot({ deferredPrompt: e })
  })
  window.addEventListener('appinstalled', () => {
    setSnapshot({ deferredPrompt: null, installed: true })
  })
}

export function getSnapshot() {
  return snapshot
}

export function subscribe(listener) {
  listeners.add(listener)
  return () => listeners.delete(listener)
}

export async function promptInstall() {
  const { deferredPrompt } = snapshot
  if (!deferredPrompt) return
  setSnapshot({ deferredPrompt: null })
  deferredPrompt.prompt()
  await deferredPrompt.userChoice
}
