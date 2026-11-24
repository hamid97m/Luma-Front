import { render, screen, waitFor, fireEvent, act } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { RequestsSection } from '../src/components/requests/RequestsSection.js'
import { SentRequestsSection } from '../src/components/requests/SentRequestsSection.js'
import { Matches } from '../src/screens/Matches.js'
import { api } from '../src/api.js'
import { dispatch } from '../src/realtime.js'
import { useRequestsStore } from '../src/store.js'
import { haptic } from '../src/telegram.js'
import { t } from '../src/i18n.js'
import type { Match, MessageRequest } from '../src/types.js'

const req = (id: string, name: string): MessageRequest => ({
  id,
  body: `hello from ${name}`,
  createdAt: '2026-11-24T10:00:00Z',
  user: { id: `u-${id}`, name, age: 30, bio: `${name} bio`, location: 'Tehran', interests: ['Hiking'], photos: ['https://img/1'] },
})
const httpError = (status: number) => Object.assign(new Error('{}'), { status })

const openRequest = async (name: string) => {
  fireEvent.click(await screen.findByLabelText(t.requests.openRequest(name)))
}

const safetyApi = vi.hoisted(() => ({ report: vi.fn(), block: vi.fn() }))
Object.assign(api, { reports: { create: safetyApi.report }, blocks: { create: safetyApi.block } })

beforeEach(() => {
  vi.clearAllMocks()
  useRequestsStore.getState().reset()
  vi.mocked(api.requests.list).mockResolvedValue({ requests: [req('r1', 'Ali'), req('r2', 'Reza')] })
  vi.mocked(api.requests.sent).mockResolvedValue({ requests: [] })
})

describe('RequestsSection', () => {
  it('renders nothing without requests', async () => {
    vi.mocked(api.requests.list).mockResolvedValue({ requests: [] })
    const { container } = render(<RequestsSection onOpenChat={vi.fn()} refreshKey={0} />)
    await waitFor(() => expect(api.requests.list).toHaveBeenCalled())
    expect(container).toBeEmptyDOMElement()
  })

  it('lists requests with a count badge and message preview', async () => {
    render(<RequestsSection onOpenChat={vi.fn()} refreshKey={0} />)
    await screen.findByText('hello from Ali')
    expect(screen.getByText('hello from Reza')).toBeInTheDocument()
    expect(screen.getByText('2')).toBeInTheDocument()
    expect(screen.queryByText(t.requests.accept)).not.toBeInTheDocument()
  })

  it('opens the profile with the full message and Accept / Ignore', async () => {
    render(<RequestsSection onOpenChat={vi.fn()} refreshKey={0} />)
    await openRequest('Ali')
    expect(screen.getByText(t.requests.messageFrom('Ali'))).toBeInTheDocument()
    expect(screen.getByText('Ali bio')).toBeInTheDocument()
    expect(screen.getByText('Tehran')).toBeInTheDocument()
    expect(screen.getByText('Hiking')).toBeInTheDocument()
    expect(screen.getByText(t.requests.ignore)).toBeInTheDocument()
  })

  it('accept → haptic, opens the chat, removes the request', async () => {
    const impact = vi.spyOn(haptic, 'impact')
    vi.mocked(api.requests.accept).mockResolvedValue({ match: { id: 'm9', matchedAt: '2026-01-05T10:00:00.000Z', user: { id: 'u-r1', name: 'Ali' } } })
    const onOpenChat = vi.fn()
    render(<RequestsSection onOpenChat={onOpenChat} refreshKey={0} />)
    await openRequest('Ali')
    fireEvent.click(screen.getByText(t.requests.accept))
    await waitFor(() => expect(onOpenChat).toHaveBeenCalledWith('m9', expect.objectContaining({ id: 'm9' })))
    expect(api.requests.accept).toHaveBeenCalledWith('r1')
    expect(impact).toHaveBeenCalledWith('medium')
    expect(screen.queryByText('hello from Ali')).not.toBeInTheDocument()
    expect(screen.getByText('hello from Reza')).toBeInTheDocument()
  })

  it('ignore → haptic, removes it without opening a chat', async () => {
    const impact = vi.spyOn(haptic, 'impact')
    vi.mocked(api.requests.ignore).mockResolvedValue({ ok: true })
    const onOpenChat = vi.fn()
    render(<RequestsSection onOpenChat={onOpenChat} refreshKey={0} />)
    await openRequest('Ali')
    fireEvent.click(screen.getByText(t.requests.ignore))
    await waitFor(() => expect(screen.queryByText('hello from Ali')).not.toBeInTheDocument())
    expect(api.requests.ignore).toHaveBeenCalledWith('r1')
    expect(impact).toHaveBeenCalledWith('light')
    expect(onOpenChat).not.toHaveBeenCalled()
  })

  it('a stale list cannot bring back a decided request', async () => {
    vi.mocked(api.requests.ignore).mockResolvedValue({ ok: true })
    const { rerender } = render(<RequestsSection onOpenChat={vi.fn()} refreshKey={0} />)
    await openRequest('Ali')
    fireEvent.click(screen.getByText(t.requests.ignore))
    await waitFor(() => expect(screen.queryByText('hello from Ali')).not.toBeInTheDocument())
    rerender(<RequestsSection onOpenChat={vi.fn()} refreshKey={1} />) // the mock still lists r1
    await waitFor(() => expect(api.requests.list).toHaveBeenCalledTimes(2))
    await act(async () => {})
    expect(screen.queryByText('hello from Ali')).not.toBeInTheDocument()
  })

  it('keeps the request and shows an error when accept fails', async () => {
    vi.mocked(api.requests.accept).mockRejectedValue(httpError(500))
    render(<RequestsSection onOpenChat={vi.fn()} refreshKey={0} />)
    await openRequest('Ali')
    fireEvent.click(screen.getByText(t.requests.accept))
    await screen.findByText(t.requests.acceptError)
    expect(screen.getByText(t.requests.accept)).toBeEnabled()
  })

  it('drops a request that is already gone', async () => {
    vi.mocked(api.requests.list).mockResolvedValue({ requests: [req('r1', 'Ali')] })
    vi.mocked(api.requests.accept).mockRejectedValue(httpError(404))
    const onOpenChat = vi.fn()
    render(<RequestsSection onOpenChat={onOpenChat} refreshKey={0} />)
    await openRequest('Ali')
    fireEvent.click(screen.getByText(t.requests.accept))
    await screen.findByText(t.requests.gone)
    expect(screen.queryByText(t.requests.accept)).not.toBeInTheDocument()
    expect(onOpenChat).not.toHaveBeenCalled()
  })

  it.each([403, 404, 409, 410])('not_available (%i) removes the card with a short message', async (status) => {
    vi.mocked(api.requests.accept).mockRejectedValue(Object.assign(new Error('{"error":"not_available"}'), { status }))
    const onOpenChat = vi.fn()
    render(<RequestsSection onOpenChat={onOpenChat} refreshKey={0} />)
    await openRequest('Ali')
    fireEvent.click(screen.getByText(t.requests.accept))
    await screen.findByText(t.requests.gone)
    expect(screen.queryByText('hello from Ali')).not.toBeInTheDocument()
    expect(screen.getByText('hello from Reza')).toBeInTheDocument()
    expect(onOpenChat).not.toHaveBeenCalled()
  })

  it('reports the sender, then still lets her decide', async () => {
    safetyApi.report.mockResolvedValue({ ok: true })
    render(<RequestsSection onOpenChat={vi.fn()} refreshKey={0} />)
    await openRequest('Ali')
    fireEvent.click(screen.getByText(t.requests.report))
    fireEvent.click(screen.getByText(t.report.reasonHarassment))
    fireEvent.click(screen.getByText(t.report.submit))
    await screen.findByText(t.report.thanks)
    expect(safetyApi.report).toHaveBeenCalledWith(expect.objectContaining({ reportedUserId: 'u-r1', context: 'discovery', reason: 'harassment' }))
    expect(screen.getByText(t.requests.ignore)).toBeEnabled()
    expect(api.requests.ignore).not.toHaveBeenCalled()
  })

  it('blocks the sender after confirming and drops the request', async () => {
    safetyApi.block.mockResolvedValue({ ok: true })
    render(<RequestsSection onOpenChat={vi.fn()} refreshKey={0} />)
    await openRequest('Ali')
    fireEvent.click(screen.getByText(t.requests.block))
    expect(screen.getByText(t.requests.blockBody)).toBeInTheDocument()
    expect(safetyApi.block).not.toHaveBeenCalled()
    fireEvent.click(screen.getByText(t.block.confirm('Ali')))
    await waitFor(() => expect(safetyApi.block).toHaveBeenCalledWith('u-r1'))
    await waitFor(() => expect(screen.queryByText('hello from Ali')).not.toBeInTheDocument())
    expect(screen.queryByText(t.requests.accept)).not.toBeInTheDocument()
    expect(api.requests.sent).toHaveBeenCalled()
  })

  it('cancelling a block keeps the request', async () => {
    render(<RequestsSection onOpenChat={vi.fn()} refreshKey={0} />)
    await openRequest('Ali')
    fireEvent.click(screen.getByText(t.requests.block))
    fireEvent.click(screen.getByText(t.block.cancel))
    expect(safetyApi.block).not.toHaveBeenCalled()
    expect(screen.getByText(t.requests.accept)).toBeInTheDocument()
  })

  it('scrolls into view once when focused by the deep link', async () => {
    const scroll = vi.mocked(Element.prototype.scrollIntoView)
    const { rerender } = render(<RequestsSection onOpenChat={vi.fn()} refreshKey={0} focus />)
    await screen.findByText('hello from Ali')
    rerender(<RequestsSection onOpenChat={vi.fn()} refreshKey={1} focus />)
    expect(scroll).toHaveBeenCalledTimes(1)
  })
})

describe('SentRequestsSection', () => {
  it('shows every sent request as waiting and nothing else, whatever the server adds', async () => {
    vi.mocked(api.requests.sent).mockResolvedValue({
      requests: ['pending', 'ignored'].map((status, i) => ({
        id: `s${i}`, body: `opener ${i}`, createdAt: '2026-11-24T10:00:00Z', status, user: { id: `w${i}`, name: `W${i}`, photo: null },
      })),
    })
    const { container } = render(<SentRequestsSection refreshKey={0} />)
    await screen.findByText('opener 1')
    expect(screen.getAllByText(t.requests.waiting)).toHaveLength(2)
    expect(container.textContent).not.toMatch(/ignored|declined/i)
    expect(container.querySelector('button')).toBeNull()
  })

  it('lists my waiting requests and refreshes on a live request event', async () => {
    vi.mocked(api.requests.sent).mockResolvedValue({
      requests: [{ id: 's1', body: 'my opener', createdAt: '2026-11-24T10:00:00Z', user: { id: 'w1', name: 'Sara', photo: null } }],
    })
    render(<SentRequestsSection refreshKey={0} />)
    await screen.findByText('my opener')
    expect(screen.getByText(t.requests.waiting)).toBeInTheDocument()
    vi.mocked(api.requests.sent).mockResolvedValue({ requests: [] })
    act(() => dispatch({ type: 'request' }))
    await waitFor(() => expect(screen.queryByText('my opener')).not.toBeInTheDocument())
  })
})

describe('Matches — accepting a request', () => {
  const accept = async () => {
    vi.mocked(api.requests.accept).mockResolvedValue({ match: { id: 'm9', matchedAt: '2026-01-05T10:00:00.000Z', user: { id: 'u-r1', name: 'Ali' } } })
    const onOpenChat = vi.fn()
    render(<Matches onOpenChat={onOpenChat} onStartDiscovering={vi.fn()} refreshKey={0} />)
    await openRequest('Ali')
    return onOpenChat
  }

  it('opens the full match from a fresh list', async () => {
    vi.mocked(api.matches.list).mockResolvedValue({ matches: [] })
    const onOpenChat = await accept()
    const full = { id: 'm9', user: { id: 'u-r1', name: 'Ali', photos: [] }, unreadCount: 0, lastMessage: null, matchedAt: '2026-11-24T10:00:00Z' } as unknown as Match
    vi.mocked(api.matches.list).mockResolvedValue({ matches: [full] })
    fireEvent.click(screen.getByText(t.requests.accept))
    await waitFor(() => expect(onOpenChat).toHaveBeenCalledWith(full))
  })

  it('still opens the chat when the match list cannot be refetched', async () => {
    vi.mocked(api.matches.list).mockResolvedValue({ matches: [] })
    const onOpenChat = await accept()
    vi.mocked(api.matches.list).mockRejectedValue(new Error('offline'))
    fireEvent.click(screen.getByText(t.requests.accept))
    await waitFor(() => expect(onOpenChat).toHaveBeenCalledWith(expect.objectContaining({
      id: 'm9', user: expect.objectContaining({ name: 'Ali', photos: ['https://img/1'] }),
    })))
  })
})
