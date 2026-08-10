import { Button, Icon } from '../components/ui'

interface Props {
  onRetry: () => void
}

// Shown when a returning (already-set-up) user fails to auth/load — e.g. a
// stale Telegram session or a transient network error — so they get a retry
// instead of being sent back through onboarding.
export function Reconnect({ onRetry }: Props) {
  return (
    <div className="flex flex-col items-center justify-center h-full gap-4 px-8 text-center bg-bg text-txt">
      <div className="w-[72px] h-[72px] rounded-m3-lg bg-primary-container flex items-center justify-center">
        <Icon name="refresh" size={32} className="text-primary" />
      </div>
      <h1 className="text-[24px] font-medium">Couldn't reconnect</h1>
      <p className="text-[14px] text-txt2 leading-relaxed">
        Something went wrong loading your account. If this keeps happening, close and reopen Luma from Telegram.
      </p>
      <Button onClick={onRetry} className="mt-2">
        Try again
      </Button>
    </div>
  )
}
