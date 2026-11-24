import { useState } from 'react'
import { t } from '../i18n.js'
import { haptic } from '../telegram.js'
import { Button, Icon } from './ui/index.js'
import type { LikesQueueInfo } from '../types.js'

// Fallback for a locked liker with no photo — a theme-token gradient (blurred
// behind the lock badge, same as the real-photo tiles).
const LOCKED_GRADIENTS = [
  'linear-gradient(135deg, var(--pc), var(--pr))',
  'linear-gradient(150deg, var(--pr), var(--gold))',
  'linear-gradient(120deg, var(--gold), var(--pc))',
]

const MAX_TILES = 6
// One row under today's like, so the invite button stays on the first screen.
const TILES_WITH_FREE_LIKE = 3

interface LockedTileProps {
  photo: string | null
  index: number
  ariaLabel: string
  /** Small caption under the lock badge. */
  caption?: string
  onClick: () => void
}

/** Blurred tile of a locked liker. Falls back to a gradient with no / broken photo. */
export function LockedTile({ photo, index, ariaLabel, caption, onClick }: LockedTileProps) {
  const [failedPhoto, setFailedPhoto] = useState<string | null>(null)
  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={ariaLabel}
      className="relative aspect-[3/4] rounded-m3-lg overflow-hidden bg-surface-high"
    >
      {photo && photo !== failedPhoto ? (
        <img
          src={photo}
          alt=""
          aria-hidden="true"
          onError={() => setFailedPhoto(photo)}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ filter: 'blur(8px)', transform: 'scale(1.08)' }}
        />
      ) : (
        <span
          className="absolute inset-0"
          style={{
            background: LOCKED_GRADIENTS[index % LOCKED_GRADIENTS.length],
            filter: 'blur(8px) saturate(.8)',
            transform: 'scale(1.08)',
          }}
          aria-hidden="true"
        />
      )}
      <span className="absolute inset-0" style={{ background: 'rgba(33,26,29,.28)' }} />
      <span className="absolute inset-0 flex flex-col items-center justify-center gap-2">
        <span
          className="w-[38px] h-[38px] rounded-full flex items-center justify-center"
          style={{ background: 'rgba(255,255,255,.92)', boxShadow: '0 3px 10px rgba(0,0,0,.2)' }}
        >
          <Icon name="lock" size={17} className="text-primary" />
        </span>
        {caption && (
          <span
            className="text-[11px] font-semibold uppercase tracking-wide text-white"
            style={{ textShadow: '0 1px 4px rgba(0,0,0,.5)' }}
          >
            {caption}
          </span>
        )}
      </span>
    </button>
  )
}

interface LikesQueueProps {
  queue: LikesQueueInfo
  /** Today's free like is on screen — the queue is everyone "else". */
  hasFreeLike: boolean
  onInvite: () => void
  onPremium: () => void
}

/** A woman's locked likes: count, blurred teasers (blurred by the server), and
 *  how to open them — invite a friend first, premium second. */
export function LikesQueue({ queue, hasFreeLike, onInvite, onPremium }: LikesQueueProps) {
  const { lockedCount, photos, inviteEnabled, premiumEnabled, daysPerFriend } = queue
  const tiles = Array.from({ length: Math.min(hasFreeLike ? TILES_WITH_FREE_LIKE : MAX_TILES, lockedCount) }, (_, i) => photos[i] ?? null)
  const unlock = () => {
    haptic.impact('light')
    if (inviteEnabled) onInvite()
    else onPremium()
  }

  return (
    <section className="px-4 pb-6" data-testid="likes-queue">
      {!hasFreeLike && (
        <p className="mt-4 rounded-m3-md bg-surface px-4 py-3 text-[13px] leading-relaxed text-txt2">
          {t.likes.freeLikeUsed}
        </p>
      )}
      <h2 className="mt-4 mb-3 px-1 text-[16px] font-semibold text-txt">
        {hasFreeLike ? t.likes.queueTitleMore(lockedCount) : t.likes.queueTitle(lockedCount)}
      </h2>
      <div className="grid grid-cols-3 gap-2">
        {tiles.map((photo, i) => (
          <LockedTile key={i} photo={photo} index={i} ariaLabel={t.likes.queueTileAria} onClick={unlock} />
        ))}
      </div>
      <div className="mt-3 rounded-[20px] bg-primary-container p-4 flex flex-col gap-2.5">
        <p className="text-[13px] leading-relaxed text-on-primary-container">
          {inviteEnabled ? t.likes.queueInviteSub(daysPerFriend) : t.likes.queuePremiumSub}
        </p>
        {inviteEnabled && (
          <Button block icon="gift" onClick={unlock}>
            {t.likes.queueInviteCta(daysPerFriend)}
          </Button>
        )}
        {premiumEnabled && (
          <Button
            block
            variant={inviteEnabled ? 'text' : 'filled'}
            onClick={() => { haptic.impact('medium'); onPremium() }}
          >
            {t.likes.queuePremiumCta}
          </Button>
        )}
      </div>
    </section>
  )
}
