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
  /**
   * Presence dot at the bottom end corner. Leave undefined for avatars that
   * never show presence; true/false fades the green dot in/out.
   */
  online?: boolean
}

export function Avatar({ src, background, size = 48, className = '', alt = '', online }: AvatarProps) {
  if (online === undefined) return <AvatarImage src={src} background={background} size={size} className={className} alt={alt} />

  // Dot sits on the circle's edge at 45°, ringed in the surface color so it
  // separates from the photo. The ring is a box-shadow — no layout impact.
  const dot = Math.max(9, Math.round(size * 0.19))
  const inset = Math.round(size * (0.5 - Math.SQRT1_2 / 2) - dot / 2)
  return (
    <span className={['relative inline-flex flex-none', className].join(' ')} style={{ width: size, height: size }}>
      <AvatarImage src={src} background={background} size={size} alt={alt} />
      <span
        aria-hidden="true"
        data-testid="online-dot"
        data-online={online ? 'true' : 'false'}
        className={[
          'absolute rounded-full bg-online pointer-events-none transition-opacity duration-300',
          online ? 'opacity-100' : 'opacity-0',
        ].join(' ')}
        style={{ width: dot, height: dot, bottom: inset, insetInlineEnd: inset, boxShadow: '0 0 0 2px var(--sc)' }}
      />
    </span>
  )
}

function AvatarImage({ src, background, size, className = '', alt }: Required<Pick<AvatarProps, 'size' | 'alt'>> & Omit<AvatarProps, 'online'>) {
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
