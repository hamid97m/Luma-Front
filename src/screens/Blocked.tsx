import { t } from '../i18n.js'

// Shown instead of reconnect/onboarding when auth/verify reports the account
// as banned. Terminal screen — no retry action, since retrying won't change
// the ban outcome.
export function Blocked() {
  return (
    <div
      className="flex flex-col items-center justify-center h-screen gap-4 px-8 text-center"
      style={{ background: 'radial-gradient(120% 90% at 50% 10%, #f43f5e 0%, #ec4067 34%, #a855f7 100%)' }}
    >
      <div className="text-5xl">🚫</div>
      <h1 className="text-[22px] font-bold text-white">{t.blocked.title}</h1>
      <p className="text-[14px] text-white/80">{t.blocked.body}</p>
    </div>
  )
}
