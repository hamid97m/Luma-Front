import { describe, it, expect, vi, beforeEach } from 'vitest'
import { render, screen, fireEvent, waitFor } from '@testing-library/react'

vi.mock('../src/api.js', () => ({
  api: {
    profile: { setLocale: vi.fn(() => Promise.resolve({ ok: true })) },
    asks: {
      link: vi.fn(), linkGender: vi.fn(), linkAnswer: vi.fn(() => Promise.resolve({ ok: true })),
      linkEvent: vi.fn(() => Promise.resolve()), event: vi.fn(() => Promise.resolve()), forMe: vi.fn(), answerForMe: vi.fn(),
    },
  },
}))

import { api } from '../src/api.js'
import { messagesFor, useLocaleStore } from '../src/i18n.js'
import { isLocaleChosenHere, isLocalePending } from '../src/i18n/locale.js'
import { AskLink } from '../src/screens/AskLink.js'
import { AskMember } from '../src/screens/AskMember.js'

const en = messagesFor('en')
const fa = messagesFor('fa')
const VIEW = {
  recipientId: 'rec-1', requesterName: 'Sara', requesterPhotoUrl: null, question: 'reply', status: 'open', watermark: 'AB12CD',
  isMember: false, profile: { name: 'Amir', age: 28, location: null, bio: null, interests: [], photos: [] }, myAnswer: null,
}
const LANDING = { state: 'landing', requesterName: 'Sara', question: 'reply' }

// Same as main.tsx: a locale change remounts everything.
function Link({ token }: { token: string }) {
  const locale = useLocaleStore((s) => s.locale)
  return <AskLink key={locale} token={token} onExit={vi.fn()} />
}
function Member() {
  const locale = useLocaleStore((s) => s.locale)
  return <AskMember key={locale} recipientId="rec-1" onClose={vi.fn()} />
}
const toggle = () => screen.getByTestId('ask-lang-toggle')

describe('language flag on the friend-side ask screens', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    localStorage.clear()
    useLocaleStore.getState().setLocale('en')
    vi.mocked(api.asks.link).mockImplementation((async (_t: string, auth: boolean) => (auth ? { state: 'ready', view: VIEW } : LANDING)) as never)
  })

  it('English landing shows the Iran flag; a tap switches to Persian and back; no profile call without an account', async () => {
    render(<Link token="t1" />)
    expect(await screen.findByText(en.ask.loginCta)).toBeInTheDocument()
    expect(toggle().querySelector('[data-flag="fa"]')).not.toBeNull()
    fireEvent.click(toggle())
    expect(await screen.findByText(fa.ask.loginCta)).toBeInTheDocument()
    expect(document.documentElement).toHaveAttribute('dir', 'rtl')
    expect(toggle().querySelector('[data-flag="en"]')).not.toBeNull()
    expect(api.profile.setLocale).not.toHaveBeenCalled()
    expect(isLocalePending()).toBe(true)
    expect(isLocaleChosenHere()).toBe(true)
    expect(vi.mocked(api.asks.linkEvent)).toHaveBeenCalledTimes(1) // landing counted once
    fireEvent.click(toggle())
    expect(await screen.findByText(en.ask.loginCta)).toBeInTheDocument()
  })

  it('Arabic also offers Persian', async () => {
    useLocaleStore.getState().setLocale('ar')
    render(<Link token="t2" />)
    await screen.findByText(messagesFor('ar').ask.loginCta)
    expect(toggle().querySelector('[data-flag="fa"]')).not.toBeNull()
  })

  it('switching on the gender step stays on the gender step', async () => {
    vi.mocked(api.asks.link).mockImplementation((async (_t: string, auth: boolean) => (auth ? { ...LANDING, state: 'need_gender' } : LANDING)) as never)
    render(<Link token="t3" />)
    fireEvent.click(await screen.findByText(en.ask.loginCta))
    expect(await screen.findByText(en.ask.genderTitle)).toBeInTheDocument()
    fireEvent.click(toggle())
    expect(await screen.findByText(fa.ask.genderTitle)).toBeInTheDocument()
  })

  it('switching mid-answer keeps the chosen verdict and the typed note', async () => {
    render(<Link token="t4" />)
    fireEvent.click(await screen.findByText(en.ask.loginCta))
    fireEvent.click(await screen.findByRole('radio', { name: en.ask.verdicts.reply.yes }))
    fireEvent.change(screen.getByRole('textbox'), { target: { value: 'nice bio' } })
    fireEvent.click(toggle())
    expect(await screen.findByRole('radio', { name: fa.ask.verdicts.reply.yes })).toHaveAttribute('aria-checked', 'true')
    expect(screen.getByRole('textbox')).toHaveValue('nice bio')
    fireEvent.click(screen.getByText(fa.ask.sendAnswer))
    await waitFor(() => expect(api.asks.linkAnswer).toHaveBeenCalledWith('t4', 'yes', 'nice bio'))
  })

  it('terminal states have the flag too', async () => {
    vi.mocked(api.asks.link).mockResolvedValue({ state: 'taken' } as never)
    render(<Link token="t5" />)
    expect(await screen.findByText(en.ask.taken)).toBeInTheDocument()
    fireEvent.click(toggle())
    expect(await screen.findByText(fa.ask.taken)).toBeInTheDocument()
  })

  it('a member\'s choice is saved to her account', async () => {
    vi.mocked(api.asks.forMe).mockResolvedValue({ ...VIEW, isMember: true } as never)
    render(<Member />)
    await screen.findByText(en.ask.sendAnswer)
    fireEvent.click(toggle())
    expect(await screen.findByText(fa.ask.sendAnswer)).toBeInTheDocument()
    expect(api.profile.setLocale).toHaveBeenCalledWith('fa')
    await waitFor(() => expect(isLocalePending()).toBe(false))
  })
})
