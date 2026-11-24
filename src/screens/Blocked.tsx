import { t } from '../i18n.js'
import { formatFullDate, formatTime } from '../i18n/format.js'
import { haptic, openTelegramLink } from '../telegram.js'
import { Button, Icon } from '../components/ui'

// Shown instead of reconnect/onboarding when auth/verify reports the account
// as banned — or temporarily suspended (`suspendedUntil` set; the suspension
// lifts on its own at that time). Terminal screen — no retry action, since
// retrying won't change the outcome. The only exit is support, which lives in
// the bot chat (the in-app ticket API is unreachable for blocked accounts).
export function Blocked({ supportBot, suspendedUntil }: { supportBot?: string | null; suspendedUntil?: string | null }) {
  const until = suspendedUntil ? new Date(suspendedUntil) : null
  const suspended = until != null && !Number.isNaN(until.getTime())
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 px-8 text-center bg-bg text-txt">
      <div className="w-[72px] h-[72px] rounded-m3-lg bg-error-container flex items-center justify-center">
        <Icon name="x-circle" size={32} className="text-error" />
      </div>
      <h1 className="text-[24px] font-medium">{suspended ? t.blocked.suspendedTitle : t.blocked.title}</h1>
      <p className="text-[14px] text-txt2 leading-relaxed">
        {suspended ? t.blocked.suspendedBody(`${formatFullDate(until)} ${formatTime(until)}`) : t.blocked.body}
      </p>
      {supportBot && (
        <Button
          icon="life-buoy"
          className="mt-2"
          onClick={() => {
            haptic.impact('light')
            openTelegramLink(`https://t.me/${supportBot}?start=support`)
          }}
        >
          {t.blocked.support}
        </Button>
      )}
    </div>
  )
}
