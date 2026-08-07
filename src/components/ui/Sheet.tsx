// Material 3 bottom sheet. Single implementation to replace the ~10 hand-rolled
// `fixed inset-0 bg-black/70 … rounded-3xl` sheets across the app. Scrim + a
// surface panel that slides up from the bottom, respecting the Telegram
// bottom safe-area inset.
import { useEffect, type ReactNode } from 'react'
import { useBackButton } from '../../telegram.js'

export interface SheetProps {
  open: boolean
  onClose: () => void
  /** Optional header title rendered with the M3 drag handle. */
  title?: ReactNode
  children: ReactNode
  /** Hide the top drag-handle affordance. */
  hideHandle?: boolean
  className?: string
}

export function Sheet({ open, onClose, title, children, hideHandle, className = '' }: SheetProps) {
  // A back-press (incl. Android hardware back) dismisses the sheet instead of
  // closing the Mini App, while it's open.
  useBackButton(open, onClose)

  // Close on Escape for browser/dev ergonomics.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  // Dismiss only when the tap lands on the scrim itself, not on content that
  // bubbled up. `cursor-pointer` is load-bearing: iOS/Telegram webviews don't
  // reliably fire `click` on a plain <div> without it.
  const onScrim = (e: { target: EventTarget | null; currentTarget: EventTarget | null }) => {
    if (e.target === e.currentTarget) onClose()
  }

  return (
    <div className="fixed inset-0 z-50 flex items-end justify-center">
      <div
        className="absolute inset-0 cursor-pointer animate-scrim-in"
        style={{ background: 'var(--scrim)' }}
        onClick={onScrim}
      />
      <div
        className={[
          'relative w-full max-w-md bg-bg text-txt rounded-t-m3-xl',
          'animate-sheet-up flex flex-col max-h-[92vh]',
          className,
        ].join(' ')}
        style={{ paddingBottom: 'calc(16px + var(--tg-safe-bottom))' }}
      >
        {!hideHandle && (
          <div className="flex justify-center pt-3 pb-1">
            <div className="w-9 h-1 rounded-full" style={{ background: 'var(--ol2)' }} />
          </div>
        )}
        {title && (
          <div className="px-5 pt-2 pb-3 text-[18px] font-medium text-txt">{title}</div>
        )}
        <div className="overflow-y-auto px-5 pt-1">{children}</div>
      </div>
    </div>
  )
}

// A plain centered modal (dialog) variant for confirmations / match popups.
export interface DialogProps {
  open: boolean
  onClose: () => void
  children: ReactNode
  className?: string
  /** Set false to keep the modal open when the scrim is tapped. */
  dismissOnScrim?: boolean
}

export function Dialog({ open, onClose, children, className = '', dismissOnScrim = true }: DialogProps) {
  useBackButton(open, onClose)
  if (!open) return null
  const onScrim = (e: { target: EventTarget | null; currentTarget: EventTarget | null }) => {
    if (dismissOnScrim && e.target === e.currentTarget) onClose()
  }
  return (
    <div
      className={`fixed inset-0 z-50 flex items-center justify-center p-6 ${dismissOnScrim ? 'cursor-pointer' : ''}`}
      style={{ background: 'var(--scrim)' }}
      onClick={onScrim}
    >
      <div
        className={['w-full max-w-sm bg-bg text-txt rounded-m3-xl shadow-m3-1 p-6 animate-fade-up cursor-auto', className].join(' ')}
      >
        {children}
      </div>
    </div>
  )
}
