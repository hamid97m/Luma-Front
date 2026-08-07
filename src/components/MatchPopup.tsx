import { useEffect } from 'react'
import { t } from '../i18n.js'
import { haptic } from '../telegram.js'
import { Dialog, Button, Icon } from './ui/index.js'

interface MatchUser {
  id: string
  name: string
  telegramId: number
  username: string | null
  photos?: string[]
}

interface Props {
  match: { id: string; user: MatchUser }
  onClose: () => void
  onMessage: () => void
}

export function MatchPopup({ match, onClose, onMessage }: Props) {
  const photo = match.user.photos?.[0]

  // Celebrate the match with a success buzz when the popup appears.
  useEffect(() => { haptic.notification('success') }, [])

  return (
    <Dialog open onClose={onClose} className="text-center">
      {photo ? (
        <img
          src={photo}
          alt={match.user.name}
          className="w-24 h-24 rounded-full object-cover mx-auto mb-4"
          style={{ boxShadow: '0 0 0 6px var(--pc)' }}
        />
      ) : (
        <div
          className="w-24 h-24 rounded-full bg-primary-container text-primary flex items-center justify-center mx-auto mb-4"
          style={{ boxShadow: '0 0 0 6px var(--pc)' }}
        >
          <Icon name="heart" size={40} />
        </div>
      )}

      <h2 className="text-[26px] font-medium text-primary mb-2">{t.match.title}</h2>
      <p className="text-txt2 mb-6 text-[14px]">{t.match.message(match.user.name)}</p>

      <Button onClick={onMessage} block className="mb-2">
        {t.match.send(match.user.name)}
      </Button>

      <Button onClick={onClose} variant="text" block>
        {t.match.keepSwiping}
      </Button>
    </Dialog>
  )
}
