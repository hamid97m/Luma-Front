import { t } from '../i18n.js'
import { haptic, openTelegramLink } from '../telegram.js'
import { Button, Icon } from '../components/ui'

// Shown instead of reconnect/onboarding when auth/verify reports the account
// as banned. Terminal screen — no retry action, since retrying won't change
// the ban outcome. The only exit is support, which lives in the bot chat
// (the in-app ticket API is unreachable for banned accounts).
export function Blocked({ supportBot }: { supportBot?: string | null }) {
  return (
    <div className="flex flex-col items-center justify-center h-screen gap-4 px-8 text-center bg-bg text-txt">
      <div className="w-[72px] h-[72px] rounded-m3-lg bg-error-container flex items-center justify-center">
        <Icon name="x-circle" size={32} className="text-error" />
      </div>
      <h1 className="text-[24px] font-medium">{t.blocked.title}</h1>
      <p className="text-[14px] text-txt2 leading-relaxed">{t.blocked.body}</p>
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
