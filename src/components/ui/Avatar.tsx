// Round avatar. Accepts an image src or a CSS background (the mockup uses
// gradient placeholders for photos), with a neutral fallback.
import type { CSSProperties } from 'react'

export interface AvatarProps {
  src?: string | null
  /** A CSS background value (e.g. a gradient) used when there's no image. */
  background?: string
  size?: number
  className?: string
  alt?: string
}

export function Avatar({ src, background, size = 48, className = '', alt = '' }: AvatarProps) {
  const style: CSSProperties = { width: size, height: size }
  if (src) {
    return (
      <img
        src={src}
        alt={alt}
        className={['rounded-full object-cover flex-none', className].join(' ')}
        style={style}
      />
    )
  }
  return (
    <div
      className={['rounded-full flex-none bg-surface-high', className].join(' ')}
      style={{ ...style, background: background || undefined }}
      role="img"
      aria-label={alt}
    />
  )
}
