import { useEffect, useRef, useState } from 'react'
import { api, type AuthUser, type WebSignInResult } from '../api.js'
import { t, useLocaleStore } from '../i18n.js'
import { Button, Card, Icon } from '../components/ui/index.js'

interface Props {
  onSignedIn: (token: string, user: AuthUser) => void
  /** account_banned from a sign-in — App shows its Blocked screen. */
  onBanned: (err: unknown) => void
}

// "Log in with Telegram" (OpenID Connect): a popup that hands back an ID token.
// https://core.telegram.org/bots/telegram-login
const TELEGRAM_LOGIN_SRC = 'https://oauth.telegram.org/js/telegram-login.js?6'
const GOOGLE_GSI_SRC = 'https://accounts.google.com/gsi/client'
// Telegram's brand blue (white-on-brand exception, like the splash gradient).
const TELEGRAM_BLUE = '#2AABEE'

interface GoogleId {
  initialize: (config: { client_id: string; callback: (res: { credential: string }) => void }) => void
  renderButton: (parent: HTMLElement, options: Record<string, unknown>) => void
}

type TelegramLoginResult = { id_token?: string; error?: string }

interface TelegramLogin {
  auth: (
    options: { client_id: number; scope?: string[]; lang?: string },
    callback: (result: TelegramLoginResult) => void,
  ) => void
}

type LoginWindow = Window & {
  google?: { accounts?: { id?: GoogleId } }
  Telegram?: { Login?: TelegramLogin }
}

const win = () => window as LoginWindow

function errorCode(err: unknown): string | null {
  if (!(err instanceof Error)) return null
  try {
    return (JSON.parse(err.message) as { error?: string }).error ?? null
  } catch {
    return null
  }
}

function errorMessage(err: unknown): string {
  const code = errorCode(err)
  if (code === 'invalid_telegram_login') return t.login.errors.invalidTelegram
  if (code === 'invalid_google_login') return t.login.errors.invalidGoogle
  if (code === 'google_account_mismatch') return t.login.errors.googleMismatch
  // Website login switched off on the server (no signing secret).
  if (code === 'web_login_unavailable') return t.login.errors.generic
  // No HTTP status → the request never got an answer.
  if ((err as { status?: number } | null)?.status == null) return t.login.errors.network
  return t.login.errors.generic
}

// Website sign-in (never shown inside Telegram): our own Telegram button opens
// Telegram's login popup; Google Identity Services renders its own button into
// our container. A script that fails to load (e.g. Google blocked) hides its option.
export function Login({ onSignedIn, onBanned }: Props) {
  const locale = useLocaleStore((s) => s.locale)
  // BotFather's Login Widget Client ID (= the bot id).
  const telegramClientId = Number(import.meta.env.VITE_TELEGRAM_CLIENT_ID) || 0
  const googleClientId = import.meta.env.VITE_GOOGLE_CLIENT_ID
  const [telegramFailed, setTelegramFailed] = useState(!telegramClientId)
  const [telegramReady, setTelegramReady] = useState(false)
  const [googleFailed, setGoogleFailed] = useState(!googleClientId)
  const [busy, setBusy] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const googleRef = useRef<HTMLDivElement>(null)
  const busyRef = useRef(false)

  // Latest props for the long-lived script callbacks.
  const handlers = useRef({ onSignedIn, onBanned })
  handlers.current = { onSignedIn, onBanned }

  const signIn = (call: () => Promise<WebSignInResult>) => {
    if (busyRef.current) return
    busyRef.current = true
    setBusy(true)
    setError(null)
    // Only the API call's rejection is a sign-in error; a throw while the app
    // continues after a successful sign-in is a bug, not a network failure.
    call()
      .then(
        ({ token, user }) => handlers.current.onSignedIn(token, user),
        (err: unknown) => {
          if (errorCode(err) === 'account_banned') handlers.current.onBanned(err)
          else setError(errorMessage(err))
        },
      )
      .catch((err: unknown) => console.error(err))
      .finally(() => {
        busyRef.current = false
        setBusy(false)
      })
  }
  const signInRef = useRef(signIn)
  signInRef.current = signIn

  // Telegram login library: load once per page; the button stays disabled
  // until it's there.
  useEffect(() => {
    if (!telegramClientId) return
    if (win().Telegram?.Login) {
      setTelegramReady(true)
      return
    }
    let cancelled = false
    let script = document.querySelector<HTMLScriptElement>(`script[src="${TELEGRAM_LOGIN_SRC}"]`)
    if (!script) {
      script = document.createElement('script')
      script.async = true
      script.src = TELEGRAM_LOGIN_SRC
      // Same as Google below: a failed element is dropped so a later visit retries.
      const failed = script
      failed.addEventListener('error', () => failed.remove(), { once: true })
      document.head.appendChild(script)
    }
    const onLoad = () => { if (!cancelled) setTelegramReady(Boolean(win().Telegram?.Login)) }
    const onError = () => { if (!cancelled) setTelegramFailed(true) }
    script.addEventListener('load', onLoad)
    script.addEventListener('error', onError)
    return () => {
      cancelled = true
      script.removeEventListener('load', onLoad)
      script.removeEventListener('error', onError)
    }
  }, [telegramClientId])

  // Must run inside the click: the library opens its popup synchronously.
  const telegramLogin = () => {
    const login = win().Telegram?.Login
    if (!login || busyRef.current) return
    setError(null)
    // `profile` carries the numeric Telegram id the backend signs in by;
    // `write` lets the bot DM the user (match / message notifications).
    login.auth({ client_id: telegramClientId, scope: ['profile', 'write'], lang: locale }, (result) => {
      if (result.id_token) {
        const idToken = result.id_token
        signInRef.current(() => api.auth.telegramOidc(idToken))
      } else if (result.error && result.error !== 'popup_closed') {
        setError(t.login.errors.invalidTelegram)
      }
    })
  }

  // Google Identity Services: load once per page, then render its button.
  useEffect(() => {
    if (!googleClientId) return
    let cancelled = false
    const render = () => {
      const id = win().google?.accounts?.id
      const el = googleRef.current
      if (cancelled || !id || !el) return
      id.initialize({
        client_id: googleClientId,
        callback: ({ credential }) => signInRef.current(() => api.auth.google(credential)),
      })
      id.renderButton(el, {
        theme: 'outline',
        size: 'large',
        shape: 'pill',
        text: 'continue_with',
        width: 280,
        locale,
      })
    }
    if (win().google?.accounts?.id) {
      render()
      return () => { cancelled = true }
    }
    let script = document.querySelector<HTMLScriptElement>(`script[src="${GOOGLE_GSI_SRC}"]`)
    if (!script) {
      script = document.createElement('script')
      script.async = true
      script.src = GOOGLE_GSI_SRC
      // A failed element would never fire again; drop it (even if this screen
      // is gone by then) so a later visit retries instead of waiting forever.
      const failed = script
      failed.addEventListener('error', () => failed.remove(), { once: true })
      document.head.appendChild(script)
    }
    const onError = () => { if (!cancelled) setGoogleFailed(true) }
    script.addEventListener('load', render)
    script.addEventListener('error', onError)
    return () => {
      cancelled = true
      script.removeEventListener('load', render)
      script.removeEventListener('error', onError)
    }
  }, [googleClientId, locale])

  const nothingToShow = telegramFailed && googleFailed

  return (
    <div className="flex flex-col h-full bg-bg text-txt overflow-y-auto" data-testid="login-screen">
      {/* Brand header — same gradient as the splash (white-on-brand exception). */}
      <div
        className="flex flex-col items-center gap-3 px-8 pb-10 rounded-b-m3-xl text-center"
        style={{
          background: 'linear-gradient(165deg, var(--pr) 0%, #8C2E68 60%, #5E2A62 100%)',
          paddingTop: 'calc(var(--tg-safe-top, 0px) + 48px)',
        }}
      >
        <img
          src="/luma-icon.png"
          alt=""
          className="w-20 h-20 rounded-m3-xl select-none"
          style={{ boxShadow: '0 12px 32px rgba(0,0,0,.3)' }}
        />
        <h1 className="text-[32px] font-medium text-white">{t.appName}</h1>
        <p className="text-[14px] text-white/90">{t.login.tagline}</p>
      </div>

      <div className="flex flex-col items-center gap-4 px-6 py-8 w-full max-w-sm mx-auto">
        <div className="text-center">
          <h2 className="text-[22px] font-medium">{t.login.title}</h2>
          <p className="mt-1 text-[14px] text-txt2">{t.login.subtitle}</p>
        </div>

        {!telegramFailed && (
          <button
            type="button"
            onClick={telegramLogin}
            disabled={!telegramReady || busy}
            className="inline-flex items-center justify-center gap-2 h-11 w-[280px] max-w-full rounded-full text-[14px] font-medium text-white shadow-m3-1 transition select-none hover:brightness-95 disabled:opacity-60 disabled:cursor-not-allowed focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary"
            style={{ background: TELEGRAM_BLUE }}
          >
            <Icon name="send" size={18} />
            {t.login.telegram}
          </button>
        )}
        {!googleFailed && (
          <div
            ref={googleRef}
            role="group"
            aria-label={t.login.google}
            className="flex justify-center min-h-[44px] w-full"
          />
        )}

        {/* Dev builds only: sign in as the backend's dev user (POST /auth/dev). */}
        {import.meta.env.DEV && (
          <Button variant="outlined" icon="settings" disabled={busy} onClick={() => signIn(() => api.auth.dev())}>
            {t.login.devLogin}
          </Button>
        )}

        {busy && <p className="text-[13px] text-txt2">{t.login.signingIn}</p>}

        {error && (
          <div role="alert" className="flex items-start gap-2 w-full rounded-m3-md bg-error-container px-4 py-3 text-[13px] text-error">
            <Icon name="alert-triangle" size={18} className="flex-none mt-px" />
            <span>{error}</span>
          </div>
        )}

        {nothingToShow && (
          <p className="text-[14px] text-txt2 text-center leading-relaxed">{t.login.unavailable}</p>
        )}
        {/* The hint points at the Telegram option, so only show it alongside one. */}
        {!telegramFailed && (
          <Card className="flex items-start gap-3 w-full">
            <Icon name="help-circle" size={20} className="flex-none text-primary mt-px" />
            <p className="text-[13px] text-txt2 leading-relaxed">{t.login.telegramHint}</p>
          </Card>
        )}
      </div>
    </div>
  )
}
