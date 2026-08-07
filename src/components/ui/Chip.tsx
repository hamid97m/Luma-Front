// Material 3 chip — pill label used for interests/tags and filter selections.
import type { ButtonHTMLAttributes, ReactNode } from 'react'

export interface ChipProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  selected?: boolean
  children: ReactNode
}

export function Chip({ selected = false, className = '', children, ...rest }: ChipProps) {
  return (
    <button
      className={[
        'inline-flex items-center gap-1.5 rounded-full px-3.5 h-9 text-[13px] font-medium',
        'transition-colors focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        selected
          ? 'bg-primary-container text-on-primary-container'
          : 'bg-surface text-txt2 border border-outline hover:bg-surface-high',
        className,
      ].join(' ')}
      {...rest}
    >
      {children}
    </button>
  )
}
