import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, act } from '@testing-library/react'

// Controllable Splash: the test decides when the intro "finishes". Kept in its
// own file because App's once-per-page-load splash guard is module state —
// only the first App render in a module ever mounts Splash.
let releaseSplash: () => void = () => {}
vi.mock('../src/screens/Splash.js', () => ({
  Splash: ({ onDone }: { onDone: () => void }) => {
    releaseSplash = onDone
    return <div data-testid="splash" />
  },
}))
vi.mock('../src/screens/Onboarding.js', () => ({
  Onboarding: () => <div data-testid="onboarding" />,
}))
vi.mock('../src/telegram.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/telegram.js')>()),
  initTelegram: vi.fn(),
}))

import { App } from '../src/App.js'
import { useLocaleStore } from '../src/i18n.js'
import { setLocalePending } from '../src/i18n/locale.js'
import { api } from '../src/api.js'

describe('App server-locale reconciliation timing', () => {
  beforeEach(() => {
    localStorage.clear()
    vi.clearAllMocks()
    // Device thinks English (e.g. Telegram UI in English); server has fa.
    useLocaleStore.setState({ locale: 'en' })
    vi.mocked(api.auth.verify).mockResolvedValue({
      user: { id: 'u1', name: 'Ali', setupComplete: false, paused: false, locale: 'fa' } as never,
    })
  })
  afterEach(() => {
    setLocalePending(false)
    useLocaleStore.getState().setLocale('fa')
  })

  it('adopts the server locale only after the splash has finished, never mid-intro', async () => {
    render(<App />)
    await waitFor(() => expect(api.auth.verify).toHaveBeenCalled())
    // Let the verify promise settle while the splash is still showing.
    await act(async () => { await Promise.resolve() })

    expect(screen.getByTestId('splash')).toBeInTheDocument()
    expect(useLocaleStore.getState().locale).toBe('en')

    act(() => releaseSplash())
    await waitFor(() => expect(useLocaleStore.getState().locale).toBe('fa'))
    expect(localStorage.getItem('luma.locale')).toBe('fa')
  })
})
