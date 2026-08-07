import { t } from '../../i18n.js'
import { Icon } from '../ui'

interface GiftBubbleProps {
  mine: boolean
  senderName: string
  emoji: string | null
}

/** Centered system-style bubble both participants see for a `type: 'gift'` message. */
export function GiftBubble({ mine, senderName, emoji }: GiftBubbleProps) {
  return (
    <div className="self-center flex flex-col items-center gap-1 px-6 py-4 my-2 rounded-m3-xl bg-surface text-txt">
      {emoji ? (
        <span role="img" aria-hidden="true" className="text-5xl leading-none">
          {emoji}
        </span>
      ) : (
        <Icon name="gift" size={44} className="text-primary" />
      )}
      <p className="text-[13px] font-medium text-txt2">
        {mine ? t.gifts.sentByMe : t.gifts.sentByOther(senderName)}
      </p>
    </div>
  )
}
