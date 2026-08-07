// Material 3 button. Pill-shaped, token-colored, theme-aware. Replaces the
// ad-hoc gradient/hex buttons scattered across screens.
import type { ButtonHTMLAttributes, ReactNode } from 'react'
import { Icon, type IconName } from './Icon.js'

type Variant = 'filled' | 'tonal' | 'text' | 'destructive' | 'outlined'
type Size = 'sm' | 'md' | 'lg'

const SIZES: Record<Size, string> = {
  sm: 'h-9 px-4 text-[13px] gap-1.5',
  md: 'h-11 px-6 text-[14px] gap-2',
  lg: 'h-14 px-7 text-[16px] gap-2',
}

// Colors come from CSS-var tokens via arbitrary values so both light and dark
// resolve automatically. Hover states use the paired *-hover / tint tokens.
const VARIANTS: Record<Variant, string> = {
  filled:
    'bg-primary text-white hover:bg-primary-hover shadow-m3-1 disabled:shadow-none',
  tonal:
    'bg-primary-container text-on-primary-container hover:brightness-[0.97] active:brightness-95',
  text: 'bg-transparent text-primary hover:bg-[var(--prtint)]',
  outlined:
    'bg-transparent text-primary border border-outline hover:bg-[var(--prtint)]',
  destructive:
    'bg-destructive text-white hover:bg-destructive-hover shadow-m3-1',
}

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: Variant
  size?: Size
  block?: boolean
  icon?: IconName
  /** Place the icon after the label instead of before. */
  trailingIcon?: IconName
  children?: ReactNode
}

export function Button({
  variant = 'filled',
  size = 'md',
  block = false,
  icon,
  trailingIcon,
  className = '',
  children,
  ...rest
}: ButtonProps) {
  const iconSize = size === 'sm' ? 16 : size === 'lg' ? 20 : 18
  return (
    <button
      className={[
        'inline-flex items-center justify-center rounded-full font-medium',
        'transition-colors select-none disabled:opacity-40 disabled:cursor-not-allowed',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        SIZES[size],
        VARIANTS[variant],
        block ? 'w-full' : '',
        className,
      ].join(' ')}
      {...rest}
    >
      {icon && <Icon name={icon} size={iconSize} />}
      {children}
      {trailingIcon && <Icon name={trailingIcon} size={iconSize} />}
    </button>
  )
}

// Circular icon-only button (FAB-adjacent). `tone` picks the fill.
export interface IconButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  icon: IconName
  size?: number
  tone?: 'primary' | 'surface' | 'ghost'
  iconSize?: number
}

export function IconButton({
  icon,
  size = 44,
  tone = 'surface',
  iconSize,
  className = '',
  ...rest
}: IconButtonProps) {
  const tones: Record<string, string> = {
    primary: 'bg-primary text-white hover:bg-primary-hover',
    surface: 'bg-surface text-txt2 hover:bg-surface-high',
    ghost: 'bg-transparent text-txt2 hover:bg-[var(--prtint)]',
  }
  return (
    <button
      className={[
        'inline-flex items-center justify-center rounded-full flex-none',
        'transition-colors disabled:opacity-40',
        'focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-primary',
        tones[tone],
        className,
      ].join(' ')}
      style={{ width: size, height: size }}
      {...rest}
    >
      <Icon name={icon} size={iconSize ?? Math.round(size * 0.5)} />
    </button>
  )
}
