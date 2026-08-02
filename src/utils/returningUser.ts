export const RETURNING_USER_KEY = 'luma_setup_complete_tg_id'

export function isReturningUser(): boolean {
  const tgId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id
  return tgId != null && localStorage.getItem(RETURNING_USER_KEY) === String(tgId)
}

export function markReturningUser(): void {
  const tgId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id
  if (tgId != null) localStorage.setItem(RETURNING_USER_KEY, String(tgId))
}

export function clearReturningUser(): void {
  localStorage.removeItem(RETURNING_USER_KEY)
}
