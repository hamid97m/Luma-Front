import { useState } from 'react'
import { t } from '../../i18n.js'
import { needsInPageBack, useBackButton } from '../../telegram.js'
import type { MessageRequest } from '../../types.js'
import { Button, Icon } from '../ui/index.js'
import { BlockSheet } from '../BlockSheet.js'
import { ReportSheet } from '../ReportSheet.js'
import { PremiumBadge } from '../premium/PremiumBadge.js'

export type RequestAction = 'accept' | 'ignore'

interface Props {
  request: MessageRequest
  busy: RequestAction | null
  error: string | null
  onClose: () => void
  onAccept: () => void
  onIgnore: () => void
  onBlocked: () => void
}

const Spinner = () => (
  <span
    className="inline-block w-4 h-4 border-2 border-current border-t-transparent rounded-full"
    style={{ animation: 'lumaSpin .8s linear infinite' }}
  />
)

/** Full-screen sender profile with their whole message (layout of LikerProfileSheet),
 * the decision, and report / block. */
export function RequestProfileSheet({ request, busy, error, onClose, onAccept, onIgnore, onBlocked }: Props) {
  useBackButton(true, onClose)
  const [safety, setSafety] = useState<'report' | 'block' | null>(null)
  const [reported, setReported] = useState(false)

  const { user } = request
  const photo = user.photos[0]

  return (
    <div
      className="fixed inset-0 z-40 flex flex-col bg-bg"
      style={{ paddingBottom: 'max(16px, var(--tg-safe-bottom))' }}
    >
      <div className="flex-1 overflow-y-auto">
        <div className="relative" style={{ height: 320 }}>
          {photo ? (
            <img src={photo} alt={user.name} className="absolute inset-0 w-full h-full object-cover" />
          ) : (
            <div className="absolute inset-0 flex items-center justify-center bg-surface-high">
              <Icon name="user" size={64} className="text-txt3" />
            </div>
          )}
          <div
            className="absolute inset-0"
            style={{ background: 'linear-gradient(180deg,rgba(0,0,0,.35) 0%,rgba(0,0,0,0) 34%,rgba(0,0,0,.6) 100%)' }}
          />
          {/* Telegram draws its own back arrow; on the website we need one. */}
          {needsInPageBack() && (
            <button
              type="button"
              onClick={onClose}
              aria-label={t.aria.back}
              className="absolute top-3 start-3 w-10 h-10 rounded-full flex items-center justify-center text-white bg-black/35 rtl:-scale-x-100"
              style={{ marginTop: 'var(--tg-safe-top)' }}
            >
              <Icon name="arrow-left" size={20} />
            </button>
          )}
          <div className="absolute inset-x-5 bottom-[18px]">
            <h1 className="text-[28px] font-medium text-white m-0 flex items-center gap-2 flex-wrap">
              <span>
                {user.name}
                {user.age != null ? `, ${user.age}` : ''}
              </span>
              {user.premium && <PremiumBadge size={20} />}
            </h1>
            {user.location && <p className="mt-0.5 text-[14px] text-white/85">{user.location}</p>}
          </div>
        </div>

        <div className="p-5 flex flex-col gap-[18px]">
          <div className="bg-surface-high rounded-m3-lg p-4">
            <p className="m-0 mb-1.5 text-[12px] font-bold text-primary">{t.requests.messageFrom(user.name)}</p>
            <p dir="auto" className="m-0 text-[15px] leading-relaxed text-txt whitespace-pre-wrap break-words">
              {request.body}
            </p>
          </div>
          {user.bio && <p dir="auto" className="m-0 text-[15px] leading-relaxed text-txt">{user.bio}</p>}
          {user.interests.length > 0 && (
            <div className="flex flex-wrap gap-2">
              {user.interests.map((tag) => (
                <span key={tag} className="px-3.5 py-[7px] rounded-full bg-surface text-txt2 text-[13px]">
                  {tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </div>

      <div className="flex-none px-5 pt-3">
        {error && <p role="alert" className="mb-2 text-center text-[13px] text-error">{error}</p>}
        <div className="flex gap-3">
          <Button variant="tonal" size="lg" onClick={onIgnore} disabled={busy !== null} className="flex-1">
            {busy === 'ignore' ? <Spinner /> : t.requests.ignore}
          </Button>
          <Button variant="filled" size="lg" onClick={onAccept} disabled={busy !== null} className="flex-1">
            {busy === 'accept' ? <Spinner /> : t.requests.accept}
          </Button>
        </div>
        <p className="mt-2 text-center text-[12px] text-txt3">{t.requests.ignoreNote}</p>
        {reported && <p role="status" className="mt-1 text-center text-[13px] text-txt2">{t.report.thanks}</p>}
        <div className="flex justify-center gap-2 pt-1">
          <Button variant="text" size="sm" onClick={() => setSafety('report')} disabled={busy !== null}>
            <Icon name="flag" size={15} />
            {t.requests.report}
          </Button>
          <Button variant="text" size="sm" className="text-error" onClick={() => setSafety('block')} disabled={busy !== null}>
            <Icon name="ban" size={15} />
            {t.requests.block}
          </Button>
        </div>
      </div>

      {safety === 'report' && (
        // No chat yet, so it's reported like a profile. The request stays: she
        // can still ignore it or block them.
        <ReportSheet
          reportedUserId={user.id}
          context="discovery"
          onClose={() => setSafety(null)}
          onSubmitted={() => { setSafety(null); setReported(true) }}
        />
      )}
      <BlockSheet
        open={safety === 'block'}
        name={user.name}
        userId={user.id}
        body={t.requests.blockBody}
        onClose={() => setSafety(null)}
        onBlocked={onBlocked}
      />
    </div>
  )
}
