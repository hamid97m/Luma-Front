interface Props {
  onRetry: () => void
}

// Shown when a returning (already-set-up) user fails to auth/load — e.g. a
// stale Telegram session or a transient network error — so they get a retry
// instead of being sent back through onboarding.
export function Reconnect({ onRetry }: Props) {
  return (
    <div
      className="flex flex-col items-center justify-center h-screen gap-4 px-8 text-center"
      style={{ background: 'radial-gradient(120% 90% at 50% 10%, #f43f5e 0%, #ec4067 34%, #a855f7 100%)' }}
    >
      <img src="/luma-icon.png" alt="" className="w-20 h-20 rounded-[24px] shadow-2xl select-none" />
      <h1 className="text-[22px] font-bold text-white">Couldn't reconnect</h1>
      <p className="text-[14px] text-white/80">
        Something went wrong loading your account. If this keeps happening, close and reopen Luma from Telegram.
      </p>
      <button
        onClick={onRetry}
        className="mt-2 px-6 py-3 rounded-full bg-white text-[#a855f7] font-semibold"
      >
        Try again
      </button>
    </div>
  )
}
