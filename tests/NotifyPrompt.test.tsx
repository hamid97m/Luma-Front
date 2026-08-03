import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import { describe, it, expect, vi, afterEach } from 'vitest'
import { NotifyPrompt } from '../src/components/NotifyPrompt.js'
import { api } from '../src/api.js'

const originalWebApp = window.Telegram?.WebApp

function setWebApp(webApp: unknown) {
  Object.assign(window, { Telegram: { WebApp: webApp } })
}

afterEach(() => {
  setWebApp(originalWebApp)
  vi.clearAllMocks()
})

describe('NotifyPrompt', () => {
  it('calls onDone without requesting access when Not now is clicked', () => {
    const requestWriteAccess = vi.fn()
    setWebApp({ requestWriteAccess, isVersionAtLeast: () => true, initDataUnsafe: {} })
    const onDone = vi.fn()
    render(<NotifyPrompt onDone={onDone} />)

    fireEvent.click(screen.getByText('Not now'))

    expect(onDone).toHaveBeenCalled()
    expect(requestWriteAccess).not.toHaveBeenCalled()
  })

  it('shows the native popup and records a grant server-side', async () => {
    setWebApp({
      requestWriteAccess: (cb?: (granted: boolean) => void) => cb?.(true),
      isVersionAtLeast: () => true,
      initDataUnsafe: {},
      HapticFeedback: { notificationOccurred: vi.fn() },
    })
    const onDone = vi.fn()
    render(<NotifyPrompt onDone={onDone} />)

    fireEvent.click(screen.getByText('Enable notifications'))

    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(api.profile.setWriteAccess).toHaveBeenCalledWith(true)
  })

  it('does not record anything when the user declines the native popup', async () => {
    setWebApp({
      requestWriteAccess: (cb?: (granted: boolean) => void) => cb?.(false),
      isVersionAtLeast: () => true,
      initDataUnsafe: {},
    })
    const onDone = vi.fn()
    render(<NotifyPrompt onDone={onDone} />)

    fireEvent.click(screen.getByText('Enable notifications'))

    await waitFor(() => expect(onDone).toHaveBeenCalled())
    expect(api.profile.setWriteAccess).not.toHaveBeenCalled()
  })
})
