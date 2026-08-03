import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { renderHook } from '@testing-library/react'
import { haptic, mainButtonSupported, useMainButton, initTelegram } from '../src/telegram.js'

// Each test injects its own WebApp shape; restore afterward so other suites
// keep the shared mock from tests/setup.ts.
const originalWebApp = window.Telegram?.WebApp

function setWebApp(webApp: unknown) {
  Object.assign(window, { Telegram: { WebApp: webApp } })
}

afterEach(() => {
  setWebApp(originalWebApp)
  document.documentElement.removeAttribute('style')
})

describe('haptic', () => {
  it('does not throw when HapticFeedback is unavailable', () => {
    setWebApp({}) // old client / no haptics
    expect(() => {
      haptic.impact()
      haptic.notification('success')
      haptic.selection()
    }).not.toThrow()
  })

  it('does not throw when Telegram is absent entirely', () => {
    setWebApp(undefined)
    expect(() => haptic.impact('light')).not.toThrow()
  })

  it('forwards to the SDK when present', () => {
    const impactOccurred = vi.fn()
    const notificationOccurred = vi.fn()
    const selectionChanged = vi.fn()
    setWebApp({ HapticFeedback: { impactOccurred, notificationOccurred, selectionChanged } })

    haptic.impact('heavy')
    haptic.notification('error')
    haptic.selection()

    expect(impactOccurred).toHaveBeenCalledWith('heavy')
    expect(notificationOccurred).toHaveBeenCalledWith('error')
    expect(selectionChanged).toHaveBeenCalled()
  })
})

describe('mainButtonSupported', () => {
  it('is false without a MainButton (browser / test env)', () => {
    setWebApp({})
    expect(mainButtonSupported()).toBe(false)
  })

  it('is true when Telegram provides a MainButton', () => {
    setWebApp({ MainButton: {} })
    expect(mainButtonSupported()).toBe(true)
  })
})

describe('initTelegram', () => {
  it('calls ready + expand and skips version-gated features on old clients', () => {
    const wa = {
      ready: vi.fn(),
      expand: vi.fn(),
      isVersionAtLeast: () => false,
      disableVerticalSwipes: vi.fn(),
      requestFullscreen: vi.fn(),
    }
    setWebApp(wa)

    initTelegram()

    expect(wa.ready).toHaveBeenCalled()
    expect(wa.expand).toHaveBeenCalled()
    expect(wa.disableVerticalSwipes).not.toHaveBeenCalled()
    expect(wa.requestFullscreen).not.toHaveBeenCalled()
  })

  it('locks swipes and requests fullscreen on a supporting client', () => {
    const wa = {
      ready: vi.fn(),
      expand: vi.fn(),
      isVersionAtLeast: (v: string) => parseFloat(v) <= 8.0,
      disableVerticalSwipes: vi.fn(),
      requestFullscreen: vi.fn(),
      onEvent: vi.fn(),
      safeAreaInset: { top: 20, bottom: 0, left: 0, right: 0 },
      contentSafeAreaInset: { top: 44, bottom: 0, left: 0, right: 0 },
    }
    setWebApp(wa)

    initTelegram()

    expect(wa.disableVerticalSwipes).toHaveBeenCalled()
    expect(wa.requestFullscreen).toHaveBeenCalled()
    // Combined top inset written to a CSS variable (20 + 44).
    expect(document.documentElement.style.getPropertyValue('--tg-safe-top')).toBe('64px')
  })
})

describe('write access', () => {
  // These functions keep per-session module state (granted/prompted), so each
  // test gets a freshly-loaded module instance.
  async function freshTelegram() {
    vi.resetModules()
    return await import('../src/telegram.js')
  }

  it('botCanMessage reflects allows_write_to_pm from initData', async () => {
    const tg = await freshTelegram()
    setWebApp({ initDataUnsafe: { user: { id: 1, first_name: 'A', allows_write_to_pm: true } } })
    expect(tg.botCanMessage()).toBe(true)

    setWebApp({ initDataUnsafe: { user: { id: 1, first_name: 'A' } } })
    expect(tg.botCanMessage()).toBe(false)
  })

  it('shouldPromptWriteAccess is true only on supporting clients without access', async () => {
    const tg = await freshTelegram()

    setWebApp({ requestWriteAccess: vi.fn(), isVersionAtLeast: () => true, initDataUnsafe: {} })
    expect(tg.shouldPromptWriteAccess()).toBe(true)

    // Already granted → no prompt
    setWebApp({
      requestWriteAccess: vi.fn(),
      isVersionAtLeast: () => true,
      initDataUnsafe: { user: { id: 1, first_name: 'A', allows_write_to_pm: true } },
    })
    expect(tg.shouldPromptWriteAccess()).toBe(false)

    // Old client without the API → no prompt
    setWebApp({ isVersionAtLeast: () => false, initDataUnsafe: {} })
    expect(tg.shouldPromptWriteAccess()).toBe(false)
  })

  it('shouldPromptWriteAccess is false after markWriteAccessPrompted', async () => {
    const tg = await freshTelegram()
    setWebApp({ requestWriteAccess: vi.fn(), isVersionAtLeast: () => true, initDataUnsafe: {} })

    expect(tg.shouldPromptWriteAccess()).toBe(true)
    tg.markWriteAccessPrompted()
    expect(tg.shouldPromptWriteAccess()).toBe(false)
  })

  it('launch prompt honors the dismissal cooldown', async () => {
    const tg = await freshTelegram()
    localStorage.removeItem('luma_notify_dismissed_at')
    setWebApp({ requestWriteAccess: vi.fn(), isVersionAtLeast: () => true, initDataUnsafe: {} })

    expect(tg.shouldPromptWriteAccessOnLaunch()).toBe(true)

    tg.markWriteAccessDismissed()
    expect(tg.shouldPromptWriteAccessOnLaunch()).toBe(false)

    // A stale dismissal no longer suppresses the prompt.
    localStorage.setItem('luma_notify_dismissed_at', String(Date.now() - 4 * 24 * 60 * 60 * 1000))
    expect(tg.shouldPromptWriteAccessOnLaunch()).toBe(true)

    localStorage.removeItem('luma_notify_dismissed_at')
  })

  it('requestWriteAccess resolves the grant and remembers it for the session', async () => {
    const tg = await freshTelegram()
    setWebApp({
      requestWriteAccess: (cb?: (granted: boolean) => void) => cb?.(true),
      isVersionAtLeast: () => true,
      initDataUnsafe: { user: { id: 1, first_name: 'A' } },
    })

    expect(tg.botCanMessage()).toBe(false)
    await expect(tg.requestWriteAccess()).resolves.toBe(true)
    expect(tg.botCanMessage()).toBe(true)
  })

  it('requestWriteAccess resolves false on clients without the API', async () => {
    const tg = await freshTelegram()
    setWebApp({ isVersionAtLeast: () => false })
    await expect(tg.requestWriteAccess()).resolves.toBe(false)
  })
})

describe('useMainButton', () => {
  function makeMainButton() {
    return {
      setText: vi.fn(),
      show: vi.fn(),
      hide: vi.fn(),
      enable: vi.fn(),
      disable: vi.fn(),
      showProgress: vi.fn(),
      hideProgress: vi.fn(),
      onClick: vi.fn(),
      offClick: vi.fn(),
    }
  }

  it('configures and shows the button, then hides on unmount', () => {
    const mb = makeMainButton()
    setWebApp({ MainButton: mb })
    const onClick = vi.fn()

    const { unmount } = renderHook(() =>
      useMainButton({ text: 'Send', visible: true, enabled: true, onClick })
    )

    expect(mb.setText).toHaveBeenCalledWith('Send')
    expect(mb.enable).toHaveBeenCalled()
    expect(mb.show).toHaveBeenCalled()
    expect(mb.onClick).toHaveBeenCalledWith(onClick)

    unmount()
    expect(mb.offClick).toHaveBeenCalledWith(onClick)
    expect(mb.hide).toHaveBeenCalled()
  })

  it('disables and shows a spinner while loading', () => {
    const mb = makeMainButton()
    setWebApp({ MainButton: mb })

    renderHook(() =>
      useMainButton({ text: 'Send', visible: true, loading: true, onClick: vi.fn() })
    )

    expect(mb.showProgress).toHaveBeenCalled()
    expect(mb.disable).toHaveBeenCalled()
  })

  it('is inert when Telegram provides no MainButton', () => {
    setWebApp({})
    expect(() =>
      renderHook(() => useMainButton({ text: 'x', visible: true, onClick: vi.fn() }))
    ).not.toThrow()
  })
})
