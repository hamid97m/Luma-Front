import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, cleanup } from '@testing-library/react'
vi.mock('../src/telegram.js', () => ({ haptic: { impact: vi.fn(), selection: vi.fn(), notification: vi.fn() } }))
import { ChatInputBar } from '../src/components/chat/ChatInputBar.js'
import { useLocaleStore } from '../src/i18n.js'

describe('ChatInputBar textarea direction', () => {
  afterEach(() => {
    cleanup()
    useLocaleStore.getState().setLocale('fa')
  })

  it('follows the locale', () => {
    useLocaleStore.getState().setLocale('en')
    const { container, unmount } = render(<ChatInputBar draft="" onDraftChange={() => {}} onSend={() => {}} />)
    expect(container.querySelector('textarea')?.getAttribute('dir')).toBe('ltr')
    unmount()

    useLocaleStore.getState().setLocale('fa')
    const r2 = render(<ChatInputBar draft="" onDraftChange={() => {}} onSend={() => {}} />)
    expect(r2.container.querySelector('textarea')?.getAttribute('dir')).toBe('rtl')
    r2.unmount()

    useLocaleStore.getState().setLocale('ar')
    const r3 = render(<ChatInputBar draft="" onDraftChange={() => {}} onSend={() => {}} />)
    expect(r3.container.querySelector('textarea')?.getAttribute('dir')).toBe('rtl')
  })

  it('keeps the gift/textarea/send row pinned LTR regardless of locale', () => {
    useLocaleStore.getState().setLocale('en')
    const { container } = render(<ChatInputBar draft="" onDraftChange={() => {}} onSend={() => {}} />)
    const row = container.querySelector('textarea')?.parentElement
    expect(row?.getAttribute('dir')).toBe('ltr')
  })
})
