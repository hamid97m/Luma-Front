// Ask-link launch flow (startapp=ask_<token>). Runs BEFORE the normal
// auth/onboarding gate so a friend without a Luma account can answer without
// one: landing → (Telegram sign-in = resolve with initData) → gender step for
// non-members → answer screen, or a terminal state (not for you / taken / closed).
import { useEffect, useRef, useState } from 'react'
import { api } from '../api.js'
import { t } from '../i18n.js'
import { closeMiniApp, haptic, useBackButton } from '../telegram.js'
import { isReturningUser } from '../utils/returningUser.js'
import { Button, Icon } from '../components/ui/index.js'
import { AskAnswer, AskStateMessage } from '../components/ask/AskAnswer.js'
import { questionLabel, showToast, trackAskLink } from '../components/ask/askUtils.js'
import type { AskLinkState, AskQuestion } from '../types.js'

interface Props {
  token: string
  /** Resolve with initData right away (bot reminder link) — no anonymous landing. */
  skipLanding?: boolean
  /** Leave the ask flow and continue into the normal app (sign-up / main). */
  onExit: () => void
}

type Phase = { kind: 'loading' } | { kind: 'error' } | AskLinkState

export function AskLink({ token, skipLanding = false, onExit }: Props) {
  const [phase, setPhase] = useState<Phase>({ kind: 'loading' })
  const [busy, setBusy] = useState(false)
  // Telegram back leaves the ask and continues into the app.
  useBackButton(true, onExit)
  // A member (this Telegram account finished sign-up here before) skips the
  // anonymous landing and resolves straight away.
  // Only decides whether to skip the landing; the final button uses view.isMember.
  const member = useRef(isReturningUser())
  const direct = useRef(skipLanding || member.current)
  // Last auth mode used, so Retry after sign-in doesn't fall back to the landing.
  const lastAuth = useRef(direct.current)

  const resolve = async (auth: boolean) => {
    lastAuth.current = auth
    try {
      const res = await api.asks.link(token, auth)
      setPhase(res)
      return res
    } catch {
      setPhase({ kind: 'error' })
      return null
    }
  }

  useEffect(() => {
    let alive = true
    ;(async () => {
      const res = await resolve(direct.current)
      if (!alive || !res) return
      const tokenState = res.state === 'invalid' ? 'invalid' : res.state === 'closed' ? 'closed' : 'valid'
      trackAskLink(token, { name: 'ask_link_landed', recipientKind: 'link', props: { token_state: tokenState } })
      if (direct.current && res.state !== 'invalid' && res.state !== 'closed') {
        trackAskLink(token, { name: 'ask_link_login', recipientKind: 'link', props: { new_account: !member.current } })
      }
    })()
    return () => { alive = false }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token])

  const signIn = async () => {
    if (busy) return
    haptic.impact('light')
    setBusy(true)
    trackAskLink(token, { name: 'ask_link_login', recipientKind: 'link', props: { new_account: !member.current } })
    await resolve(true)
    setBusy(false)
  }

  const pickGender = async (gender: 'female' | 'male') => {
    if (busy) return
    haptic.selection()
    setBusy(true)
    try {
      setPhase(await api.asks.linkGender(token, gender))
    } catch {
      showToast(t.errors.generic)
    } finally {
      setBusy(false)
    }
  }

  const shell = (children: React.ReactNode) => (
    <div className="h-full flex flex-col bg-bg text-txt" style={{ paddingTop: 'var(--tg-safe-top)', paddingBottom: 'var(--tg-safe-bottom)' }}>
      {children}
    </div>
  )

  if ('kind' in phase && phase.kind === 'loading') {
    return shell(
      <div className="flex-1 flex items-center justify-center" data-testid="ask-link-loading">
        <img src="/luma-icon.png" alt="" className="w-14 h-14 rounded-m3-lg animate-pulse-heart select-none" />
      </div>,
    )
  }

  if ('kind' in phase) {
    return shell(
      <AskStateMessage icon="alert-triangle" title={t.errors.generic}>
        <Button variant="tonal" onClick={() => { setPhase({ kind: 'loading' }); resolve(lastAuth.current) }}>{t.errors.retry}</Button>
      </AskStateMessage>,
    )
  }

  switch (phase.state) {
    case 'landing':
      return shell(<Landing requesterName={phase.requesterName} question={phase.question} busy={busy} onSignIn={signIn} />)
    case 'need_gender':
      return shell(
        <div className="flex-1 flex flex-col justify-center px-6 gap-4">
          <h1 className="text-[20px] font-medium text-center">{t.ask.genderTitle}</h1>
          <div className="grid grid-cols-2 gap-3">
            <Button variant="tonal" size="lg" disabled={busy} onClick={() => pickGender('female')}>{t.ask.genderFemale}</Button>
            <Button variant="outlined" size="lg" disabled={busy} onClick={() => pickGender('male')}>{t.ask.genderMale}</Button>
          </div>
        </div>,
      )
    case 'not_for_you':
      return shell(<Terminal icon="lock" title={t.ask.notForYou} onOpenApp={onExit} />)
    case 'taken':
      return shell(<Terminal icon="lock" title={t.ask.taken} onOpenApp={onExit} />)
    case 'closed':
    case 'invalid':
      return shell(<Terminal icon="clock" title={t.ask.closed} onOpenApp={onExit} />)
    case 'ready':
      return (
        <AskAnswer
          view={phase.view}
          recipientKind="link"
          onBack={onExit}
          onSubmit={async (verdict, note) => { await api.asks.linkAnswer(token, verdict, note) }}
          thanksFooter={
            <Button block variant={phase.view.isMember ? 'tonal' : 'filled'} size="lg" onClick={onExit}>
              {phase.view.isMember ? t.ask.backToLuma : t.ask.tryLuma}
            </Button>
          }
        />
      )
  }
}

function Terminal({ icon, title, onOpenApp }: { icon: 'lock' | 'clock'; title: string; onOpenApp: () => void }) {
  return (
    <AskStateMessage icon={icon} title={title}>
      <Button onClick={onOpenApp}>{t.ask.openLuma}</Button>
      <Button variant="tonal" onClick={() => closeMiniApp()}>{t.ask.close}</Button>
    </AskStateMessage>
  )
}

// Screen 3 — non-member landing: who's asking, a locked teaser (no real
// profile data), reassurance lines, sign-in CTA / "not now".
function Landing({ requesterName, question, busy, onSignIn }: { requesterName: string; question: AskQuestion; busy: boolean; onSignIn: () => void }) {
  const initial = requesterName.trim().charAt(0)
  return (
    <div className="flex-1 overflow-y-auto px-5 pb-5 pt-4 flex flex-col gap-4">
      <div className="flex items-center justify-center gap-2">
        <img src="/luma-icon.png" alt="" className="w-7 h-7 rounded-m3-sm" />
        <span className="text-[16px] font-medium">{t.appName}</span>
      </div>

      <div className="flex flex-col items-center text-center gap-2">
        <span className="w-14 h-14 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center text-[20px] font-medium">
          {initial}
        </span>
        <h1 className="text-[20px] font-medium">{t.ask.wantsYourOpinion(requesterName)}</h1>
        <p className="text-[14px] text-txt2">{t.ask.landingSub[question] ?? t.ask.landingSub.reply}</p>
        <p className="text-[13px] text-txt3">{t.ask.asksQuestion(questionLabel(question))}</p>
      </div>

      {/* Blurred, data-free teaser */}
      <div className="relative h-[200px] rounded-m3-xl overflow-hidden bg-surface-high" data-testid="ask-landing-teaser">
        <div className="absolute inset-0" style={{ background: 'linear-gradient(160deg, var(--sch), var(--ol2))', filter: 'blur(6px)' }} />
        <div className="absolute inset-0 flex flex-col items-center justify-center gap-2 text-txt">
          <span className="w-11 h-11 rounded-full bg-bg/80 flex items-center justify-center">
            <Icon name="lock" size={20} />
          </span>
          <span className="text-[13px] font-medium">{t.ask.lockedProfile}</span>
        </div>
      </div>

      <div className="flex flex-col gap-2.5 text-[13px] text-txt2">
        <div className="flex items-center gap-2"><Icon name="shield" size={18} className="text-primary flex-none" />{t.ask.reassureHidden}</div>
        <div className="flex items-center gap-2"><Icon name="clock" size={18} className="text-primary flex-none" />{t.ask.reassureFast}</div>
        <div className="flex items-center gap-2"><Icon name="heart" size={18} className="text-primary flex-none" />{t.ask.reassureFree}</div>
      </div>

      <div className="flex-1" />
      <p className="text-[13px] text-txt2 text-center">{t.ask.onlyAdvise(requesterName)}</p>
      <Button block size="lg" onClick={onSignIn} disabled={busy}>{t.ask.loginCta}</Button>
      <Button block variant="text" onClick={() => closeMiniApp()}>{t.ask.notNow}</Button>
    </div>
  )
}
