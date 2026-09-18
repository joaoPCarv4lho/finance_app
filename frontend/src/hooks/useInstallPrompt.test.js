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
