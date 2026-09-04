// Name validation shared by onboarding and the profile editor.
// A name must be at least 2 characters and must not contain any digit —
// Latin (0-9), Persian (۰-۹) or Arabic-Indic (٠-٩), since Persian users may
// type either script. The backend enforces the same rule authoritatively.
const DIGIT_RE = /[0-9۰-۹٠-٩]/

export function nameHasDigit(name: string): boolean {
  return DIGIT_RE.test(name)
}

export function isValidName(name: string): boolean {
  const trimmed = name.trim()
  return trimmed.length >= 2 && !nameHasDigit(trimmed)
}
