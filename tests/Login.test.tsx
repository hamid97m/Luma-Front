import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'

vi.mock('../src/api.ts', () => ({
  onAccountPaused: () => () => {},
  api: {
    auth: { verify: vi.fn(), me: vi.fn(), telegramWeb: vi.fn(), google: vi.fn(), dev: vi.fn() },
  },
}))

import { Login } from '../src/screens/Login.js'
import { api } from '../src/api.js'
import { t } from '../src/i18n.js'

const USER = { id: 'u1', name: 'Ali', setupComplete: true, paused: false }
const TG_PAYLOAD = { id: 42, first_name: 'Ali', auth_date: 1_700_000_000, hash: 'abc' }

type GoogleInit = { client_id: string; callback: (r: { credential: string }) => void }

const apiError = (status: number, body: object) =>
  Object.assign(new Error(JSON.stringify(body)), { status })

const googleScript = () =>
  document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]')
const telegramScript = () =>
  document.querySelector<HTMLScriptElement>('script[src^="https://telegram.org/js/telegram-widget.js"]')

/** Simulate the GIS script arriving; returns the config passed to initialize(). */
function loadGoogle(): { init: () => GoogleInit; renderButton: ReturnType<typeof vi.fn> } {
  let config: GoogleInit | undefined
  const renderButton = vi.fn()
  ;(window as unknown as { google: unknown }).google = {
    accounts: { id: { initialize: vi.fn((c: GoogleInit) => { config = c }), renderButton } },
  }
  act(() => { fireEvent.load(googleScript()!) })
  return { init: () => config!, renderButton }
}

const telegramAuth = (payload: object) =>
  (window as unknown as { onTelegramAuth: (u: object) => void }).onTelegramAuth(payload)

function renderLogin() {
  const onSignedIn = vi.fn()
  const onBanned = vi.fn()
  render(<Login onSignedIn={onSignedIn} onBanned={onBanned} />)
  return { onSignedIn, onBanned }
}

describe('Login', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client-id')
    vi.stubEnv('VITE_TELEGRAM_BOT_USERNAME', 'LumaDatingBot')
    vi.mocked(api.auth.telegramWeb).mockReset()
    vi.mocked(api.auth.google).mockReset()
    vi.mocked(api.auth.dev).mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    googleScript()?.remove()
    delete (window as unknown as { google?: unknown }).google
  })

  it('renders the Telegram and Google options and the Telegram hint', () => {
    renderLogin()

    expect(screen.getByLabelText(t.login.telegram)).toBeInTheDocument()
    expect(screen.getByLabelText(t.login.google)).toBeInTheDocument()
    expect(screen.getByText(t.login.telegramHint)).toBeInTheDocument()

    const tg = telegramScript()!
    expect(tg.dataset.telegramLogin).toBe('LumaDatingBot')
    expect(tg.dataset.onauth).toBe('onTelegramAuth(user)')
    expect(googleScript()).not.toBeNull()
  })

  it('Google credential → api.auth.google → onSignedIn(token, user)', async () => {
    vi.mocked(api.auth.google).mockResolvedValue({ token: 'tok', user: USER } as never)
    const { onSignedIn } = renderLogin()

    const { init, renderButton } = loadGoogle()
    expect(init().client_id).toBe('test-client-id')
    expect(renderButton).toHaveBeenCalledWith(screen.getByLabelText(t.login.google), expect.any(Object))

    await act(async () => { init().callback({ credential: 'google-jwt' }) })

    expect(api.auth.google).toHaveBeenCalledWith('google-jwt')
    expect(onSignedIn).toHaveBeenCalledWith('tok', USER)
  })

  it('Telegram widget callback → api.auth.telegramWeb → onSignedIn(token, user)', async () => {
    vi.mocked(api.auth.telegramWeb).mockResolvedValue({ token: 'tok', user: USER } as never)
    const { onSignedIn } = renderLogin()

    await act(async () => { telegramAuth(TG_PAYLOAD) })

    expect(api.auth.telegramWeb).toHaveBeenCalledWith(TG_PAYLOAD)
    expect(onSignedIn).toHaveBeenCalledWith('tok', USER)
  })

  it('invalid_telegram_login shows an inline error', async () => {
    vi.mocked(api.auth.telegramWeb).mockRejectedValue(apiError(401, { error: 'invalid_telegram_login' }))
    const { onSignedIn } = renderLogin()

    await act(async () => { telegramAuth(TG_PAYLOAD) })

    expect(screen.getByRole('alert')).toHaveTextContent(t.login.errors.invalidTelegram)
    expect(onSignedIn).not.toHaveBeenCalled()
  })

  it('invalid_google_login shows an inline error', async () => {
    vi.mocked(api.auth.google).mockRejectedValue(apiError(401, { error: 'invalid_google_login' }))
    renderLogin()

    const { init } = loadGoogle()
    await act(async () => { init().callback({ credential: 'bad' }) })

    expect(screen.getByRole('alert')).toHaveTextContent(t.login.errors.invalidGoogle)
  })

  it('google_account_mismatch shows an inline error', async () => {
    vi.mocked(api.auth.google).mockRejectedValue(apiError(401, { error: 'google_account_mismatch' }))
    renderLogin()

    const { init } = loadGoogle()
    await act(async () => { init().callback({ credential: 'other' }) })

    expect(screen.getByRole('alert')).toHaveTextContent(t.login.errors.googleMismatch)
  })

  it('a network failure shows an inline error', async () => {
    vi.mocked(api.auth.telegramWeb).mockRejectedValue(new TypeError('Failed to fetch'))
    renderLogin()

    await act(async () => { telegramAuth(TG_PAYLOAD) })

    expect(screen.getByRole('alert')).toHaveTextContent(t.login.errors.network)
  })

  it('account_banned hands the error to onBanned instead of showing it', async () => {
    const banned = apiError(401, { error: 'account_banned', botUsername: 'LumaDatingBot' })
    vi.mocked(api.auth.telegramWeb).mockRejectedValue(banned)
    const { onBanned, onSignedIn } = renderLogin()

    await act(async () => { telegramAuth(TG_PAYLOAD) })

    expect(onBanned).toHaveBeenCalledWith(banned)
    expect(onSignedIn).not.toHaveBeenCalled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('hides the Google button when its script fails to load', () => {
    renderLogin()
    act(() => { fireEvent.error(googleScript()!) })

    expect(screen.queryByLabelText(t.login.google)).not.toBeInTheDocument()
    expect(screen.getByLabelText(t.login.telegram)).toBeInTheDocument()
  })

  it('hides the Telegram button when its script fails to load', () => {
    renderLogin()
    act(() => { fireEvent.error(telegramScript()!) })

    expect(screen.queryByLabelText(t.login.telegram)).not.toBeInTheDocument()
    expect(screen.queryByText(t.login.telegramHint)).not.toBeInTheDocument()
    expect(screen.getByLabelText(t.login.google)).toBeInTheDocument()
  })

  it('shows an unavailable notice when neither sign-in script loads', () => {
    renderLogin()
    act(() => {
      fireEvent.error(googleScript()!)
      fireEvent.error(telegramScript()!)
    })

    expect(screen.getByText(t.login.unavailable)).toBeInTheDocument()
  })

  it('dev build: dev button signs in via api.auth.dev', async () => {
    vi.mocked(api.auth.dev).mockResolvedValue({ token: 'dev-tok', user: USER } as never)
    const { onSignedIn } = renderLogin()

    fireEvent.click(screen.getByRole('button', { name: /dev/i }))

    await waitFor(() => expect(onSignedIn).toHaveBeenCalledWith('dev-tok', USER))
    expect(api.auth.dev).toHaveBeenCalledTimes(1)
  })

  it('production build: no dev button', () => {
    vi.stubEnv('DEV', false)
    renderLogin()

    expect(screen.queryByRole('button', { name: /dev/i })).not.toBeInTheDocument()
  })
})
