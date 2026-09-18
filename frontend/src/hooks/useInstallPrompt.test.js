import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook, act, cleanup } from '@testing-library/react'

let matchesStandalone

function setUserAgent(ua) {
  Object.defineProperty(window.navigator, 'userAgent', { value: ua, configurable: true })
}

function setMaxTouchPoints(n) {
  Object.defineProperty(window.navigator, 'maxTouchPoints', { value: n, configurable: true })
}

async function loadHook() {
  vi.resetModules()
  const mod = await import('./useInstallPrompt')
  return mod.useInstallPrompt
}

beforeEach(() => {
  matchesStandalone = false
  window.matchMedia = vi.fn().mockImplementation((query) => ({
    matches: query === '(display-mode: standalone)' ? matchesStandalone : false,
    media: query,
    addListener: () => {},
    removeListener: () => {},
  }))
  Object.defineProperty(window.navigator, 'standalone', { value: undefined, configurable: true })
  setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64) Chrome/128.0 Safari/537.36')
  setMaxTouchPoints(0)
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
    const useInstallPrompt = await loadHook()
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

  it('captures beforeinstallprompt even when it fires before any component mounts', async () => {
    // Regression test for the bug the final review caught: the listener
    // must live at module scope (imported once at app bootstrap), not
    // inside the hook's own effect, so an event firing before any
    // component using the hook has mounted is still captured.
    const useInstallPrompt = await loadHook()
    fireBeforeInstallPrompt()
    const { result } = renderHook(() => useInstallPrompt())
    expect(result.current.canInstall).toBe(true)
  })

  it('detects iOS (iPhone/iPod) when no beforeinstallprompt is available and the app is not installed', async () => {
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15')
    const useInstallPrompt = await loadHook()
    const { result } = renderHook(() => useInstallPrompt())
    expect(result.current.isIOS).toBe(true)
    expect(result.current.canInstall).toBe(false)
  })

  it('detects iPadOS reporting a desktop Safari user agent (touch-capable Macintosh)', async () => {
    setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15')
    setMaxTouchPoints(5)
    const useInstallPrompt = await loadHook()
    const { result } = renderHook(() => useInstallPrompt())
    expect(result.current.isIOS).toBe(true)
    expect(result.current.canInstall).toBe(false)
  })

  it('does not treat a real desktop Mac (no touch) as iOS', async () => {
    setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Safari/605.1.15')
    setMaxTouchPoints(0)
    const useInstallPrompt = await loadHook()
    const { result } = renderHook(() => useInstallPrompt())
    expect(result.current.isIOS).toBe(false)
    expect(result.current.canInstall).toBe(false)
  })

  it('offers nothing when the app is already installed (standalone), even on iOS', async () => {
    matchesStandalone = true
    setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15')
    const useInstallPrompt = await loadHook()
    const { result } = renderHook(() => useInstallPrompt())
    expect(result.current.canInstall).toBe(false)
    expect(result.current.isIOS).toBe(false)
  })

  it('offers nothing on platforms with neither the native prompt nor iOS (e.g. desktop Firefox)', async () => {
    setUserAgent('Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:130.0) Gecko/20100101 Firefox/130.0')
    const useInstallPrompt = await loadHook()
    const { result } = renderHook(() => useInstallPrompt())
    expect(result.current.canInstall).toBe(false)
    expect(result.current.isIOS).toBe(false)
  })

  it('does not throw when window.matchMedia is unavailable, and falls back to not-standalone', async () => {
    // Regression test for the bug fixed in commit 18815ff: the original
    // `window.matchMedia?.(...).matches` only guarded the call with
    // optional chaining, not the `.matches` access, so it threw when
    // matchMedia was undefined instead of falling back gracefully.
    const originalMatchMedia = window.matchMedia
    window.matchMedia = undefined
    try {
      const useInstallPrompt = await loadHook()
      expect(() => renderHook(() => useInstallPrompt())).not.toThrow()
    } finally {
      window.matchMedia = originalMatchMedia
    }
  })
})
