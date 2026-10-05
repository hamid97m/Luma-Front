import { describe, it, expect, vi, afterEach } from 'vitest'
import { render, screen, cleanup } from '@testing-library/react'

vi.mock('../src/telegram.js', () => ({
  haptic: { impact: vi.fn(), selection: vi.fn(), notification: vi.fn() },
  useBackButton: vi.fn(),
}))

// These modules are imported (and their module scope evaluated) while the store
// is still 'fa' — the production launch order: bundle loads in the Telegram
// language, then /auth/verify brings the saved locale and the App remounts.
import { BottomNav } from '../src/components/BottomNav.js'
import { ReportSheet } from '../src/components/ReportSheet.js'
import { useLocaleStore } from '../src/i18n.js'
import { en } from '../src/locales/en.js'
import { fa } from '../src/locales/fa.js'

afterEach(() => {
  cleanup()
  useLocaleStore.getState().setLocale('fa')
})

describe('UI text follows a locale set after module import', () => {
  it('BottomNav labels', () => {
    useLocaleStore.getState().setLocale('en')
    render(<BottomNav active="discovery" onChange={vi.fn()} />)
    expect(screen.getByText(en.nav.discovery)).toBeInTheDocument()
    expect(screen.queryByText(fa.nav.discovery)).not.toBeInTheDocument()
  })

  it('ReportSheet reason labels', () => {
    useLocaleStore.getState().setLocale('en')
    render(<ReportSheet reportedUserId="u1" context="discovery" onClose={vi.fn()} onSubmitted={vi.fn()} />)
    expect(screen.getByText(en.report.reasonFake)).toBeInTheDocument()
    expect(screen.queryByText(fa.report.reasonFake)).not.toBeInTheDocument()
  })
})
