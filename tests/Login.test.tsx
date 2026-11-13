import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, fireEvent, act, waitFor } from '@testing-library/react'

vi.mock('../src/api.ts', () => ({
  onAccountPaused: () => () => {},
  api: {
    auth: { verify: vi.fn(), me: vi.fn(), telegramOidc: vi.fn(), google: vi.fn(), dev: vi.fn() },
  },
}))

import { Login } from '../src/screens/Login.js'
import { api } from '../src/api.js'
import { t } from '../src/i18n.js'

const USER = { id: 'u1', name: 'Ali', setupComplete: true, paused: false }

type GoogleInit = { client_id: string; callback: (r: { credential: string }) => void }

const apiError = (status: number, body: object) =>
  Object.assign(new Error(JSON.stringify(body)), { status })

const googleScript = () =>
  document.querySelector<HTMLScriptElement>('script[src="https://accounts.google.com/gsi/client"]')
const telegramScript = () =>
  document.querySelector<HTMLScriptElement>('script[src^="https://oauth.telegram.org/js/telegram-login.js"]')

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

type TgWindow = { Telegram: { Login?: { auth: ReturnType<typeof vi.fn> } } }
const tgWindow = () => window as unknown as TgWindow

/** Simulate Telegram's login library arriving; its popup answers with `result`. */
function loadTelegram(result: object = { id_token: 'tg-jwt' }) {
  const auth = vi.fn((_options: object, cb: (r: object) => void) => cb(result))
  tgWindow().Telegram.Login = { auth }
  act(() => { fireEvent.load(telegramScript()!) })
  return auth
}

const telegramButton = () => screen.getByRole('button', { name: t.login.telegram })
const clickTelegram = async () => { await act(async () => { fireEvent.click(telegramButton()) }) }

/** Sign in through the Telegram popup, which answers with an ID token. */
async function telegramSignIn() {
  loadTelegram()
  await clickTelegram()
}

function renderLogin() {
  const onSignedIn = vi.fn()
  const onBanned = vi.fn()
  render(<Login onSignedIn={onSignedIn} onBanned={onBanned} />)
  return { onSignedIn, onBanned }
}

describe('Login', () => {
  beforeEach(() => {
    vi.stubEnv('VITE_GOOGLE_CLIENT_ID', 'test-client-id')
    vi.stubEnv('VITE_TELEGRAM_CLIENT_ID', '8750905850')
    vi.mocked(api.auth.telegramOidc).mockReset()
    vi.mocked(api.auth.google).mockReset()
    vi.mocked(api.auth.dev).mockReset()
  })

  afterEach(() => {
    vi.unstubAllEnvs()
    googleScript()?.remove()
    telegramScript()?.remove()
    delete (window as unknown as { google?: unknown }).google
    delete tgWindow().Telegram.Login
  })

  it('renders the Telegram and Google options and the Telegram hint', () => {
    renderLogin()

    expect(telegramButton()).toBeInTheDocument()
    expect(screen.getByLabelText(t.login.google)).toBeInTheDocument()
    expect(screen.getByText(t.login.telegramHint)).toBeInTheDocument()

    expect(telegramScript()).not.toBeNull()
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

  it('Telegram button is disabled until the login library has loaded', () => {
    renderLogin()
    expect(telegramButton()).toBeDisabled()
    loadTelegram()
    expect(telegramButton()).toBeEnabled()
  })

  it('Telegram popup ID token → api.auth.telegramOidc → onSignedIn(token, user)', async () => {
    vi.mocked(api.auth.telegramOidc).mockResolvedValue({ token: 'tok', user: USER } as never)
    const { onSignedIn } = renderLogin()

    const auth = loadTelegram()
    await clickTelegram()

    expect(auth).toHaveBeenCalledWith(
      { client_id: 8750905850, scope: ['profile', 'write'], lang: expect.any(String) }, expect.any(Function),
    )
    expect(api.auth.telegramOidc).toHaveBeenCalledWith('tg-jwt')
    expect(onSignedIn).toHaveBeenCalledWith('tok', USER)
  })

  it('closing the Telegram popup is silent; a popup error shows the Telegram error', async () => {
    renderLogin()

    loadTelegram({ error: 'popup_closed' })
    await clickTelegram()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()

    tgWindow().Telegram.Login!.auth.mockImplementation((_o: object, cb: (r: object) => void) => cb({ error: 'access_denied' }))
    await clickTelegram()
    expect(screen.getByRole('alert')).toHaveTextContent(t.login.errors.invalidTelegram)
    expect(api.auth.telegramOidc).not.toHaveBeenCalled()
  })

  it('no client id configured → no Telegram option', () => {
    vi.stubEnv('VITE_TELEGRAM_CLIENT_ID', '')
    renderLogin()

    expect(screen.queryByRole('button', { name: t.login.telegram })).not.toBeInTheDocument()
    expect(telegramScript()).toBeNull()
  })

  it('invalid_telegram_login shows an inline error', async () => {
    vi.mocked(api.auth.telegramOidc).mockRejectedValue(apiError(401, { error: 'invalid_telegram_login' }))
    const { onSignedIn } = renderLogin()

    await telegramSignIn()

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

  it('web_login_unavailable (server not configured) shows the generic error', async () => {
    vi.mocked(api.auth.telegramOidc).mockRejectedValue(apiError(503, { error: 'web_login_unavailable' }))
    renderLogin()

    await telegramSignIn()

    expect(screen.getByRole('alert')).toHaveTextContent(t.login.errors.generic)
  })

  it('a network failure shows an inline error', async () => {
    vi.mocked(api.auth.telegramOidc).mockRejectedValue(new TypeError('Failed to fetch'))
    renderLogin()

    await telegramSignIn()

    expect(screen.getByRole('alert')).toHaveTextContent(t.login.errors.network)
  })

  it('account_banned hands the error to onBanned instead of showing it', async () => {
    const banned = apiError(401, { error: 'account_banned', botUsername: 'LumaDatingBot' })
    vi.mocked(api.auth.telegramOidc).mockRejectedValue(banned)
    const { onBanned, onSignedIn } = renderLogin()

    await telegramSignIn()

    expect(onBanned).toHaveBeenCalledWith(banned)
    expect(onSignedIn).not.toHaveBeenCalled()
    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
  })

  it('hides the Google button when its script fails to load', () => {
    renderLogin()
    act(() => { fireEvent.error(googleScript()!) })

    expect(screen.queryByLabelText(t.login.google)).not.toBeInTheDocument()
    expect(telegramButton()).toBeInTheDocument()
  })

  it('a later visit after a failed Google load retries instead of leaving a blank gap', () => {
    const first = render(<Login onSignedIn={vi.fn()} onBanned={vi.fn()} />)
    act(() => { fireEvent.error(googleScript()!) })
    // The failed element is gone, so it can't be mistaken for a pending load.
    expect(googleScript()).toBeNull()
    first.unmount()

    renderLogin()
    expect(googleScript()).not.toBeNull()
    act(() => { fireEvent.error(googleScript()!) })
    expect(screen.queryByLabelText(t.login.google)).not.toBeInTheDocument()
  })

  it('an error thrown while continuing after sign-in is not shown as a sign-in error', async () => {
    vi.mocked(api.auth.telegramOidc).mockResolvedValue({ token: 'tok', user: USER } as never)
    const consoleError = vi.spyOn(console, 'error').mockImplementation(() => {})
    render(<Login onSignedIn={() => { throw new Error('boom') }} onBanned={vi.fn()} />)

    await telegramSignIn()

    expect(screen.queryByRole('alert')).not.toBeInTheDocument()
    expect(consoleError).toHaveBeenCalled()
    consoleError.mockRestore()
  })

  it('hides the Telegram button when its script fails to load', () => {
    renderLogin()
    act(() => { fireEvent.error(telegramScript()!) })

    expect(screen.queryByRole('button', { name: t.login.telegram })).not.toBeInTheDocument()
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

    fireEvent.click(screen.getByRole('button', { name: t.login.devLogin }))

    await waitFor(() => expect(onSignedIn).toHaveBeenCalledWith('dev-tok', USER))
    expect(api.auth.dev).toHaveBeenCalledTimes(1)
  })

  it('production build: no dev button', () => {
    vi.stubEnv('DEV', false)
    renderLogin()

    expect(screen.queryByRole('button', { name: t.login.devLogin })).not.toBeInTheDocument()
  })
})
