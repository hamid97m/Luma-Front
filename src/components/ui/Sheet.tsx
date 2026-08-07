// Material 3 bottom sheet. Single implementation to replace the ~10 hand-rolled
// `fixed inset-0 bg-black/70 … rounded-3xl` sheets across the app. Scrim + a
// surface panel that slides up from the bottom, respecting the Telegram
// bottom safe-area inset.
import { useEffect, type ReactNode } from 'react'

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
  // Close on Escape for browser/dev ergonomics.
  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose() }
    window.addEventListener('keydown', onKey)
    return () => window.removeEventListener('keydown', onKey)
  }, [open, onClose])

  if (!open) return null

  return (
    <div
      className="fixed inset-0 z-50 flex items-end justify-center"
      style={{ background: 'var(--scrim)' }}
      onClick={onClose}
    >
      <div
        className={[
          'w-full max-w-md bg-bg text-txt rounded-t-m3-xl',
          'animate-fade-up flex flex-col max-h-[92vh]',
          className,
        ].join(' ')}
        style={{ paddingBottom: 'calc(16px + var(--tg-safe-bottom))' }}
        onClick={(e) => e.stopPropagation()}
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
  if (!open) return null
  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-6"
      style={{ background: 'var(--scrim)' }}
      onClick={dismissOnScrim ? onClose : undefined}
    >
      <div
        className={['w-full max-w-sm bg-bg text-txt rounded-m3-xl shadow-m3-1 p-6 animate-fade-up', className].join(' ')}
        onClick={(e) => e.stopPropagation()}
      >
        {children}
      </div>
    </div>
  )
}
