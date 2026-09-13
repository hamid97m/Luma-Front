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

// Cached per-account gender so the splash (which renders before auth resolves)
// can pick gender-specific taglines on the next launch.
const GENDER_KEY = 'luma_gender'

export function cacheGender(gender: string): void {
  const tgId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id
  if (tgId != null) localStorage.setItem(GENDER_KEY, `${tgId}:${gender}`)
}

export function cachedGenderIsWoman(): boolean {
  const tgId = window.Telegram?.WebApp?.initDataUnsafe?.user?.id
  return tgId != null && localStorage.getItem(GENDER_KEY) === `${tgId}:woman`
}
