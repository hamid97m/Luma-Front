import { t } from '../i18n.js'

// The backend's AI/regex review of user-written profile text (see PUT
// /profile/me and POST /profile/me/check-text). A rejected value comes back as
// HTTP 422 { error: 'profile_text_rejected', field, reason } and nothing is
// saved; hitting the per-user check cap is HTTP 429 { error: 'profile_text_check_limit' }.
// Lives outside api.ts so screens can use it while tests mock the api module.

export type ProfileTextField = 'name' | 'bio' | 'icebreaker_answer'
export type ProfileTextReason = 'contact_info' | 'fake_name' | 'offensive' | 'sexual' | 'ad_or_spam' | 'other'

export type ProfileTextError =
  | { kind: 'rejected'; field: ProfileTextField; reason: ProfileTextReason }
  | { kind: 'limit' }

const FIELDS: readonly string[] = ['name', 'bio', 'icebreaker_answer']
const REASONS: readonly string[] = ['contact_info', 'fake_name', 'offensive', 'sexual', 'ad_or_spam']

/** Parse an error thrown by api.request() (Error(body text) with .status). */
export function profileTextError(err: unknown): ProfileTextError | null {
  if (!(err instanceof Error)) return null
  const status = (err as { status?: number }).status
  if (status !== 422 && status !== 429) return null
  let body: { error?: unknown; field?: unknown; reason?: unknown }
  try { body = JSON.parse(err.message) } catch { return null }
  if (!body || typeof body !== 'object') return null
  if (status === 429) return body.error === 'profile_text_check_limit' ? { kind: 'limit' } : null
  if (body.error !== 'profile_text_rejected') return null
  const field = FIELDS.includes(body.field as string) ? (body.field as ProfileTextField) : null
  if (!field) return null
  // An unknown future reason still blocks the save; show the generic copy.
  const reason = REASONS.includes(body.reason as string) ? (body.reason as ProfileTextReason) : 'other'
  return { kind: 'rejected', field, reason }
}

/** The user-facing message for a parsed profile-text error, in the active locale. */
export function profileTextMessage(e: ProfileTextError): string {
  if (e.kind === 'limit') return t.profileText.limit
  return t.profileText[e.reason](t.profileText.fields[e.field])
}
