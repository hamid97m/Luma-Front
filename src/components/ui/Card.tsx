// Material 3 surface card — tonal fill, rounded, optional elevation.
import type { HTMLAttributes, ReactNode } from 'react'

export interface CardProps extends HTMLAttributes<HTMLDivElement> {
  /** 'filled' = surface container tone; 'outlined' = bg + outline border. */
  variant?: 'filled' | 'outlined'
  elevated?: boolean
  children?: ReactNode
}

export function Card({ variant = 'filled', elevated = false, className = '', children, ...rest }: CardProps) {
  return (
    <div
      className={[
        'rounded-m3-xl p-4',
        variant === 'filled' ? 'bg-surface' : 'bg-bg border border-outline',
        elevated ? 'shadow-m3-1' : '',
        className,
      ].join(' ')}
      {...rest}
    >
      {children}
    </div>
  )
}
