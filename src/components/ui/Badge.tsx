// Small count/notification badge (e.g. unread matches on the bottom nav).
import type { ReactNode } from 'react'

export interface BadgeProps {
  children: ReactNode
  className?: string
  /** 'primary' fill, or 'error' for destructive counts. */
  tone?: 'primary' | 'error'
}

export function Badge({ children, className = '', tone = 'primary' }: BadgeProps) {
  return (
    <span
      className={[
        'inline-flex items-center justify-center min-w-[18px] h-[18px] px-1.5',
        'rounded-full text-[10px] font-medium leading-none text-white',
        tone === 'error' ? 'bg-destructive' : 'bg-primary',
        className,
      ].join(' ')}
    >
      {children}
    </span>
  )
}
