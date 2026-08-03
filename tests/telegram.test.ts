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
