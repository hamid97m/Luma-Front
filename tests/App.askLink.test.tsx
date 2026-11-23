import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest'
import { render, screen, waitFor, fireEvent } from '@testing-library/react'
import { useEffect } from 'react'

vi.mock('../src/api.ts', () => ({
  onAccountPaused: () => () => {},
  api: {
    auth: { verify: vi.fn() },
    profile: { get: vi.fn(), update: vi.fn(), setLocale: vi.fn(() => Promise.resolve({ ok: true })) },
    matches: { list: vi.fn(() => Promise.resolve({ matches: [] })), unreadCount: vi.fn(() => Promise.resolve({ count: 0 })) },
    likes: { unreadCount: vi.fn(() => Promise.resolve({ count: 0 })) },
    premium: { status: vi.fn(() => Promise.reject(new Error('n/a'))) },
    referrals: { me: vi.fn(() => Promise.reject(new Error('n/a'))) },
    swipes: { swipe: vi.fn(() => Promise.resolve({ matched: false })) },
    asks: {
      config: vi.fn(() => Promise.resolve({ enabled: true })),
      link: vi.fn(),
      linkGender: vi.fn(),
      linkAnswer: vi.fn(),
      linkEvent: vi.fn(() => Promise.resolve()),
      event: vi.fn(() => Promise.resolve()),
      forMe: vi.fn(),
      answerForMe: vi.fn(),
      get: vi.fn(),
    },
  },
}))
vi.mock('../src/screens/Splash.js', () => ({
  Splash: ({ onDone }: { onDone: () => void }) => {
    useEffect(() => { onDone() }, [])
    return null
  },
}))
vi.mock('../src/telegram.js', async (importOriginal) => ({
  ...(await importOriginal<typeof import('../src/telegram.js')>()),
  initTelegram: vi.fn(),
  shouldPromptWriteAccessOnLaunch: vi.fn(() => false),
  closeMiniApp: vi.fn(),
}))
vi.mock('../src/screens/Discovery.js', () => ({ Discovery: () => <div data-testid="discovery" /> }))
vi.mock('../src/screens/Likes.js', () => ({ Likes: () => null }))
vi.mock('../src/screens/Matches.js', () => ({ Matches: () => null }))
vi.mock('../src/screens/MyProfile.js', () => ({ MyProfile: () => null }))
vi.mock('../src/screens/Onboarding.js', () => ({ Onboarding: () => <div data-testid="onboarding" /> }))
vi.mock('../src/components/premium/PaywallSheet.js', () => ({ PaywallSheet: () => null }))
vi.mock('../src/components/referrals/InviteSheet.js', () => ({ InviteSheet: () => null }))

import { App, resetAskLaunchState } from '../src/App.js'
import { api } from '../src/api.js'
import { t } from '../src/i18n.js'
import { closeMiniApp } from '../src/telegram.js'
import { RETURNING_USER_KEY } from '../src/utils/returningUser.js'
import { useAskConfigStore, useAskDecisionStore } from '../src/components/ask/askUtils.js'
import type { AskRecipientView } from '../src/types.js'

const VIEW: AskRecipientView = {
  recipientId: 'rec-1', requesterName: 'Sara', requesterPhotoUrl: null, question: 'reply', status: 'open',
  watermark: 'AB12CD',
  isMember: false,
  profile: { name: 'Amir', age: 28, location: null, bio: null, interests: [], photos: [] },
  myAnswer: null,
}

const unsafe = () => window.Telegram!.WebApp!.initDataUnsafe as { start_param?: string }

describe('App — ask-a-friend launch routing', () => {
  beforeEach(() => {
    localStorage.clear()
    localStorage.setItem('luma.locale', 'fa')
    vi.clearAllMocks()
    window.Telegram!.WebApp!.showAlert = vi.fn()
    useAskConfigStore.setState({ enabled: false })
    useAskDecisionStore.setState({ pending: null })
    resetAskLaunchState()
    vi.mocked(api.auth.verify).mockResolvedValue({
      user: { id: 'u1', name: 'Sara', setupComplete: true, paused: false, locale: 'fa' } as never,
    })
  })
  afterEach(() => {
    delete unsafe().start_param
    window.history.replaceState(null, '', '/')
  })

  it('startapp=ask_<token> shows the anonymous landing and never calls auth/verify', async () => {
    unsafe().start_param = 'ask_TOKEN123'
    vi.mocked(api.asks.link).mockResolvedValue({ state: 'landing', requesterName: 'Sara', question: 'reply' })
    render(<App />)
    expect(await screen.findByText(t.ask.wantsYourOpinion('Sara'))).toBeInTheDocument()
    expect(api.asks.link).toHaveBeenCalledWith('TOKEN123', false)
    expect(screen.getByText(t.ask.onlyAdvise('Sara'))).toBeInTheDocument()
    expect(api.auth.verify).not.toHaveBeenCalled()
    expect(api.asks.linkEvent).toHaveBeenCalledWith('TOKEN123', expect.objectContaining({ name: 'ask_link_landed' }))

    fireEvent.click(screen.getByRole('button', { name: t.ask.notNow }))
    expect(closeMiniApp).toHaveBeenCalled()
  })

  it('sign-in → gender step → answer screen → answer via the link endpoint → try Luma enters onboarding', async () => {
    unsafe().start_param = 'ask_TOK'
    vi.mocked(api.asks.link)
      .mockResolvedValueOnce({ state: 'landing', requesterName: 'Sara', question: 'reply' })
      .mockResolvedValueOnce({ state: 'need_gender', requesterName: 'Sara', question: 'reply' })
    vi.mocked(api.asks.linkGender).mockResolvedValue({ state: 'ready', view: VIEW })
    vi.mocked(api.asks.linkAnswer).mockResolvedValue({ ok: true })
    vi.mocked(api.auth.verify).mockResolvedValue({ user: { id: 'u9', name: 'Maryam', setupComplete: false } as never })
    render(<App />)

    fireEvent.click(await screen.findByRole('button', { name: t.ask.loginCta }))
    await waitFor(() => expect(api.asks.link).toHaveBeenLastCalledWith('TOK', true))
    fireEvent.click(await screen.findByRole('button', { name: t.ask.genderFemale }))
    await waitFor(() => expect(api.asks.linkGender).toHaveBeenCalledWith('TOK', 'female'))

    fireEvent.click(await screen.findByRole('radio', { name: t.ask.verdicts.reply.yes }))
    fireEvent.click(screen.getByRole('button', { name: t.ask.sendAnswer }))
    await waitFor(() => expect(api.asks.linkAnswer).toHaveBeenCalledWith('TOK', 'yes', undefined))
    expect(api.auth.verify).not.toHaveBeenCalled()

    fireEvent.click(await screen.findByRole('button', { name: t.ask.tryLuma }))
    await waitFor(() => expect(api.auth.verify).toHaveBeenCalled())
  })

  it('once left, the ask flow is not re-entered by a remount (keyed <App> on locale change)', async () => {
    unsafe().start_param = 'ask_TOK'
    vi.mocked(api.asks.link).mockResolvedValue({ state: 'ready', view: VIEW })
    vi.mocked(api.asks.linkAnswer).mockResolvedValue({ ok: true })
    const { unmount } = render(<App />)
    fireEvent.click(await screen.findByRole('radio', { name: t.ask.verdicts.reply.yes }))
    fireEvent.click(screen.getByRole('button', { name: t.ask.sendAnswer }))
    fireEvent.click(await screen.findByRole('button', { name: t.ask.tryLuma }))
    await screen.findByTestId('discovery')
    unmount()
    vi.mocked(api.asks.link).mockClear()
    render(<App />) // start_param is still set for the session
    await screen.findByTestId('discovery')
    expect(api.asks.link).not.toHaveBeenCalled()
  })

  it.each([
    ['not_for_you', t.ask.notForYou],
    ['taken', t.ask.taken],
    ['closed', t.ask.closed],
  ] as const)('resolved state %s shows its message', async (state, text) => {
    unsafe().start_param = 'ask_TOK'
    localStorage.setItem(RETURNING_USER_KEY, '123') // a member resolves straight away
    vi.mocked(api.asks.link).mockResolvedValue({ state } as never)
    render(<App />)
    expect(await screen.findByText(text)).toBeInTheDocument()
    expect(api.asks.link).toHaveBeenCalledWith('TOK', true)
    expect(screen.queryByText(t.ask.wantsYourOpinion('Sara'))).not.toBeInTheDocument()
  })

  it('?screen=ask_link&r=<id> (bot reminder) skips the landing and resolves r_<id> with initData before auth', async () => {
    window.history.replaceState(null, '', '/?screen=ask_link&r=rec-9')
    vi.mocked(api.asks.link).mockResolvedValue({ state: 'ready', view: VIEW })
    render(<App />)
    expect(await screen.findByText(t.ask.wantsYourOpinion('Sara'))).toBeInTheDocument()
    expect(api.asks.link).toHaveBeenCalledTimes(1)
    expect(api.asks.link).toHaveBeenCalledWith('r_rec-9', true)
    expect(api.auth.verify).not.toHaveBeenCalled()
  })

  it('a member advisor (view.isMember) gets "back to Luma" after answering', async () => {
    unsafe().start_param = 'ask_TOK'
    vi.mocked(api.asks.link)
      .mockResolvedValueOnce({ state: 'landing', requesterName: 'Sara', question: 'reply' })
      .mockResolvedValueOnce({ state: 'ready', view: { ...VIEW, isMember: true } })
    vi.mocked(api.asks.linkAnswer).mockResolvedValue({ ok: true })
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: t.ask.loginCta }))
    fireEvent.click(await screen.findByRole('radio', { name: t.ask.verdicts.reply.no }))
    fireEvent.click(screen.getByRole('button', { name: t.ask.sendAnswer }))
    expect(await screen.findByRole('button', { name: t.ask.backToLuma })).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: t.ask.tryLuma })).not.toBeInTheDocument()
  })

  it('an invalid token shows the ended state', async () => {
    unsafe().start_param = 'ask_BAD'
    vi.mocked(api.asks.link).mockResolvedValue({ state: 'invalid' })
    render(<App />)
    expect(await screen.findByText(t.ask.closed)).toBeInTheDocument()
  })

  it('a non-ask start_param keeps the normal launch', async () => {
    unsafe().start_param = 'promo_x'
    render(<App />)
    await screen.findByTestId('discovery')
    expect(api.auth.verify).toHaveBeenCalled()
    expect(api.asks.link).not.toHaveBeenCalled()
  })

  it('?screen=ask&r=<id> opens the member answer screen after auth', async () => {
    window.history.replaceState(null, '', '/?screen=ask&r=rec-1')
    vi.mocked(api.asks.forMe).mockResolvedValue(VIEW)
    render(<App />)
    expect(await screen.findByTestId('ask-member')).toBeInTheDocument()
    await waitFor(() => expect(api.asks.forMe).toHaveBeenCalledWith('rec-1'))
    expect(await screen.findByText(t.ask.wantsYourOpinion('Sara'))).toBeInTheDocument()
  })

  it('?screen=ask_result&id=<askId> opens the results screen; reply returns to Discovery', async () => {
    window.history.replaceState(null, '', '/?screen=ask_result&id=ask-1')
    const now = new Date().toISOString()
    vi.mocked(api.asks.get).mockResolvedValue({
      id: 'ask-1', targetId: 't1', targetName: 'Amir', targetPhotoUrl: null, question: 'reply', status: 'open',
      createdAt: now, expiresAt: now, total: 1, answered: 0, yes: 0, unsure: 0, no: 0,
      target: { id: 't1', name: 'Amir', age: 28, photoUrl: null }, recipients: [],
    })
    const { unmount } = render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: t.ask.replyCta('Amir') }))
    await waitFor(() => expect(screen.queryByTestId('ask-results')).not.toBeInTheDocument())
    expect(screen.getByTestId('discovery')).toBeInTheDocument()
    expect(useAskDecisionStore.getState().pending).toEqual({ targetId: 't1', decision: 'reply' })
    // Closed for good: a remount doesn't reopen it.
    unmount()
    vi.mocked(api.asks.get).mockClear()
    render(<App />)
    await screen.findByTestId('discovery')
    expect(screen.queryByTestId('ask-results')).not.toBeInTheDocument()
    expect(api.asks.get).not.toHaveBeenCalled()
  })

  it('?screen=ask_result pass is handed to Discovery (no direct swipe from App)', async () => {
    window.history.replaceState(null, '', '/?screen=ask_result&id=ask-1')
    const now = new Date().toISOString()
    vi.mocked(api.asks.get).mockResolvedValue({
      id: 'ask-1', targetId: 't1', targetName: 'Amir', targetPhotoUrl: null, question: 'reply', status: 'open',
      createdAt: now, expiresAt: now, total: 1, answered: 0, yes: 0, unsure: 0, no: 0,
      target: { id: 't1', name: 'Amir', age: 28, photoUrl: null }, recipients: [],
    })
    render(<App />)
    fireEvent.click(await screen.findByRole('button', { name: t.ask.passAria }))
    await waitFor(() => expect(screen.queryByTestId('ask-results')).not.toBeInTheDocument())
    expect(useAskDecisionStore.getState().pending).toEqual({ targetId: 't1', decision: 'pass' })
    expect(api.swipes.swipe).not.toHaveBeenCalled()
  })

  it('loads the ask config once in the main app', async () => {
    render(<App />)
    await screen.findByTestId('discovery')
    await waitFor(() => expect(useAskConfigStore.getState().enabled).toBe(true))
  })
})
