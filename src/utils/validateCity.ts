// City validation shared by onboarding and the profile editor.
// A city is required, 2–40 characters after trim, must include a letter,
// and must not contain a digit — Latin (0-9), Persian (۰-۹) or Arabic-Indic
// (٠-٩). The backend enforces the same rule authoritatively.
const DIGIT_RE = /[0-9۰-۹٠-٩]/
const LETTER_RE = /\p{L}/u

export const CITY_MAX_LENGTH = 40

export type CityError = 'empty' | 'digits' | 'too_long' | 'invalid'

export function cityError(city: string): CityError | null {
  const trimmed = city.trim()
  if (!trimmed) return 'empty'
  if (DIGIT_RE.test(trimmed)) return 'digits'
  if (trimmed.length > CITY_MAX_LENGTH) return 'too_long'
  if (trimmed.length < 2 || !LETTER_RE.test(trimmed)) return 'invalid'
  return null
}

export function isValidCity(city: string): boolean {
  return cityError(city) === null
}
