import type { UserProfile, DiscoveryProfile, Match, Message, SwipeResult, SupportTicketListItem, SupportThread, SupportMessage, GiftCatalogItem, GiftIntro, PremiumStatus, SwipeLimitStatus, LikesResponse, DirectChatStatus, DirectChatResult, MessageRequest, SentRequest, ReferralStatus, TonPaysPaymentInfo, AskQuestion, AskVerdict, AskSummary, AskDetail, AskFriend, AskRecipientView, AskLinkState } from './types.js'
import type { Locale } from './i18n/locale.js'
import { compressImage } from './utils/compress.js'
import { clientHeaders, endSession, isInsideTelegram } from './session.js'

const BASE = import.meta.env.VITE_API_URL as string

type PausedListener = () => void
const pausedListeners = new Set<PausedListener>()

/** Subscribe to a mid-session pause. Returns an unsubscribe. */
export function onAccountPaused(fn: PausedListener): () => void {
  pausedListeners.add(fn)
  return () => { pausedListeners.delete(fn) }
}

function notifyAccountPaused(): void {
  for (const fn of pausedListeners) fn()
}

async function request<T>(path: string, options?: RequestInit, opts?: { noAuth?: boolean }): Promise<T> {
  // Only advertise a JSON content-type when we actually send a body — Fastify 4
  // rejects an empty body carrying `application/json` with FST_ERR_CTP_EMPTY_JSON_BODY,
  // which is what body-less POSTs (e.g. photos.fromTelegram, gift intro accept/dismiss)
  // were hitting.
  const hasBody = options?.body != null
  const headers: Record<string, string> = {
    ...(hasBody ? { 'Content-Type': 'application/json' } : {}),
    ...clientHeaders(),
    ...(options?.headers as Record<string, string> | undefined),
  }
  // Public ask-link landing: ask anonymously so opening the link doesn't claim it.
  if (opts?.noAuth) delete headers.Authorization
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    keepalive: true,
    headers,
  })
  // 204 No Content (e.g. analytics events) has no JSON body.
  if (res.ok && res.status === 204) return undefined as T
  if (!res.ok) {
    const text = await res.text()
    if (res.status === 403 && text.includes('account_paused')) notifyAccountPaused()
    const err = Object.assign(new Error(text), { status: res.status })
    // Website only: the session was rejected mid-use. Sign-in calls (/auth/*)
    // report their own failures; inside Telegram nothing changes.
    if (res.status === 401 && !isInsideTelegram() && !path.startsWith('/auth/')) {
      endSession(text.includes('account_banned') || text.includes('"suspended"') ? { kind: 'banned', error: err } : { kind: 'signedOut' })
    }
    throw err
  }
  return res.json() as Promise<T>
}

function reportUploadProgress(
  onProgress: ((pct: number, phase?: 'uploading' | 'finalizing') => void) | undefined,
  pct: number,
) {
  // `upload.onprogress` hits 100 when the bytes have left the phone. Storage
  // still has to accept the file, and confirm still has to record it. Leaving
  // the bar on 100 through that wait is what looks stuck.
  if (pct >= 100) onProgress?.(100, 'finalizing')
  else onProgress?.(pct, 'uploading')
}

/** No upload progress for this long → give up (`code: 'timeout'`). On a bad
 *  connection the XHR can otherwise hang forever behind a spinner. */
export const UPLOAD_STALL_MS = 45_000

function putWithProgress(url: string, blob: Blob, onProgress?: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    let stall: ReturnType<typeof setTimeout> | undefined
    const armStall = () => {
      clearTimeout(stall)
      stall = setTimeout(() => {
        xhr.abort()
        reject(Object.assign(new Error('upload_timeout'), { code: 'timeout' }))
      }, UPLOAD_STALL_MS)
    }
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', 'image/jpeg')
    xhr.upload.onprogress = (e) => {
      armStall()
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      clearTimeout(stall)
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(Object.assign(new Error(`storage_put_failed: ${xhr.status}`), { status: xhr.status }))
    }
    xhr.onerror = () => {
      clearTimeout(stall)
      reject(new Error('storage_put_failed'))
    }
    armStall()
    xhr.send(blob)
  })
}

/** compressImage failing is a file problem, not the network. */
async function compressForUpload(file: File): Promise<Blob> {
  try {
    return await compressImage(file)
  } catch {
    throw Object.assign(new Error('compression_failed'), { code: 'compress' })
  }
}

/** The `user` every sign-in endpoint answers with (same shape as /auth/verify). */
export type AuthUser = Pick<UserProfile, 'id' | 'name' | 'setupComplete' | 'paused'> | UserProfile

/** Telegram Login Widget callback payload, posted as-is to /auth/telegram-web. */
/** Exit-survey answer sent with DELETE /profile/me (Settings → Delete account). */
export type DeleteReason =
  | 'found_someone'
  | 'few_matches'
  | 'no_replies'
  | 'fake_profiles'
  | 'too_expensive'
  | 'privacy_safety'
  | 'buggy'
  | 'taking_break'
  | 'other'

export interface TelegramWidgetPayload {
  id: number
  first_name: string
  last_name?: string
  username?: string
  photo_url?: string
  auth_date: number
  hash: string
}

export type WebSignInResult = { token: string; user: AuthUser }

/** Ask-a-friend analytics event (POST /asks/events, best-effort). */
export interface AskEventInput {
  name: string
  requestId?: string
  recipientKind?: 'member' | 'link'
  props?: Record<string, unknown>
}

const askLinkPath = (token: string) => `/asks/link/${encodeURIComponent(token)}`

export const api = {
  auth: {
    verify: (initData: string) =>
      request<{ user: AuthUser }>(
        '/auth/verify',
        { method: 'POST', body: JSON.stringify({ initData }) }
      ),
    me: () => request<{ user: AuthUser }>('/auth/me'),
    telegramWeb: (payload: TelegramWidgetPayload) =>
      request<WebSignInResult>('/auth/telegram-web', { method: 'POST', body: JSON.stringify(payload) }),
    google: (credential: string) =>
      request<WebSignInResult>('/auth/google', { method: 'POST', body: JSON.stringify({ credential }) }),
    // Non-production backends only.
    dev: () => request<WebSignInResult>('/auth/dev', { method: 'POST' }),
  },
  profile: {
    get: () => request<UserProfile>('/profile/me'),
    update: (data: Partial<Omit<UserProfile, 'id' | 'photos' | 'setupComplete'>>) =>
      request<UserProfile>('/profile/me', { method: 'PUT', body: JSON.stringify(data) }),
    // Optional exit survey answer; sent as a JSON body only when given, so a
    // skipped survey stays a body-less DELETE.
    delete: (feedback?: { reason?: DeleteReason; note?: string }) =>
      request<{ ok: boolean }>('/profile/me', {
        method: 'DELETE',
        ...(feedback ? { body: JSON.stringify(feedback) } : {}),
      }),
    setWriteAccess: (granted: boolean) =>
      request<{ ok: boolean }>('/profile/me/write-access', {
        method: 'POST',
        body: JSON.stringify({ granted }),
      }),
    setLocale: (locale: Locale) =>
      request<{ ok: boolean; locale: Locale }>('/profile/me/locale', {
        method: 'PATCH',
        body: JSON.stringify({ locale }),
      }),
    // Pre-check a profile text (onboarding name step) without saving it.
    // Rejects with 422 profile_text_rejected / 429 profile_text_check_limit —
    // parse with profileTextError() from utils/profileTextError.
    checkText: (field: 'name' | 'bio' | 'icebreaker_answer', text: string) =>
      request<{ ok: true }>('/profile/me/check-text', {
        method: 'POST',
        body: JSON.stringify({ field, text }),
      }),
  },
  photos: {
    getUploadUrl: (contentType: string, replacePhotoId?: string) =>
      request<{ uploadUrl: string; photoId: string }>(
        '/profile/me/photos/upload-url',
        { method: 'POST', body: JSON.stringify({ contentType, replacePhotoId }) }
      ),
    confirm: (photoId: string) =>
      request<{ photo: { id: string; url: string; position: number } }>(
        '/profile/me/photos/confirm',
        { method: 'POST', body: JSON.stringify({ photoId }) }
      ),
    delete: (photoId: string) =>
      request<{ ok: boolean }>(`/profile/me/photos/${photoId}`, { method: 'DELETE' }),
    fromTelegram: () =>
      request<{ photo: { id: string; url: string; position: number } }>(
        '/profile/me/photos/from-telegram',
        { method: 'POST' }
      ),
    reorder: (order: string[]) =>
      request<{ ok: boolean }>('/profile/me/photos/reorder', {
        method: 'PATCH',
        body: JSON.stringify({ order }),
      }),
    upload: async (
      file: File,
      onProgress?: (pct: number, phase?: 'uploading' | 'finalizing') => void
    ): Promise<{ id: string; url: string; position: number }> => {
      const blob = await compressForUpload(file)
      const { uploadUrl, photoId } = await api.photos.getUploadUrl('image/jpeg')
      // Cap the byte transfer at 99. Confirm still runs after the bytes land, and
      // a frozen "100%" reads as a stuck upload.
      await putWithProgress(uploadUrl, blob, (pct) => reportUploadProgress(onProgress, pct))
      onProgress?.(100, 'finalizing')
      const { photo } = await api.photos.confirm(photoId)
      return photo
    },
    // Swap an existing photo for a freshly uploaded one, keeping its position.
    replace: async (
      oldPhotoId: string,
      file: File,
      onProgress?: (pct: number, phase?: 'uploading' | 'finalizing') => void
    ): Promise<{ id: string; url: string; position: number }> => {
      const blob = await compressForUpload(file)
      const { uploadUrl, photoId: newPhotoId } = await api.photos.getUploadUrl('image/jpeg', oldPhotoId)
      await putWithProgress(uploadUrl, blob, (pct) => reportUploadProgress(onProgress, pct))
      onProgress?.(100, 'finalizing')
      const { photo } = await request<{ photo: { id: string; url: string; position: number } }>(
        `/profile/me/photos/${oldPhotoId}/replace`,
        { method: 'POST', body: JSON.stringify({ newPhotoId }) }
      )
      return photo
    },
  },
  discovery: {
    feed: () =>
      request<{ profiles: DiscoveryProfile[]; exhausted: boolean; swipeLimit?: SwipeLimitStatus; directChat?: DirectChatStatus }>('/discovery'),
  },
  swipes: {
    swipe: (targetUserId: string, direction: 'like' | 'pass') =>
      request<SwipeResult>('/swipes', {
        method: 'POST',
        body: JSON.stringify({ targetUserId, direction }),
      }),
  },
  directChat: {
    /** `message` is required when the target must accept first (400 `message_required`). */
    start: (targetUserId: string, message?: string) =>
      request<DirectChatResult>(
        '/discovery/direct-chat',
        { method: 'POST', body: JSON.stringify({ targetUserId, ...(message ? { message } : {}) }) },
      ),
  },
  requests: {
    /** Message requests waiting for my decision. */
    list: () => request<{ requests: MessageRequest[] }>('/requests'),
    /** Requests I sent that are still waiting. */
    sent: () => request<{ requests: SentRequest[] }>('/requests/sent'),
    accept: (id: string) =>
      request<{ match: { id: string; matchedAt: string; user: { id: string; name: string } } }>(
        `/requests/${encodeURIComponent(id)}/accept`, { method: 'POST' },
      ),
    ignore: (id: string) =>
      request<{ ok: boolean }>(`/requests/${encodeURIComponent(id)}/ignore`, { method: 'POST' }),
  },
  matches: {
    list: () => request<{ matches: Match[] }>('/matches'),
    unreadCount: () => request<{ count: number }>('/matches/unread-count'),
  },
  likes: {
    list: () => request<LikesResponse>('/likes'),
    unreadCount: () => request<{ count: number }>('/likes/unread-count'),
  },
  messages: {
    /** `after` → only messages newer than that message id (incremental refresh). */
    list: (matchId: string, after?: string) =>
      request<{ messages: Message[] }>(
        `/matches/${matchId}/messages${after ? `?after=${encodeURIComponent(after)}` : ''}`,
      ),
    /** Mark the counterpart's unread messages in this chat as read. */
    markRead: (matchId: string) =>
      request<{ ok: boolean }>(`/matches/${matchId}/read`, { method: 'POST' }),
    /** Tell the counterpart I'm typing (ephemeral; callers throttle and ignore failures). */
    typing: (matchId: string) =>
      request<{ ok: boolean }>(`/matches/${matchId}/typing`, { method: 'POST' }),
    send: (matchId: string, body: string, replyToMessageId?: string) =>
      request<{ message: Message }>(`/matches/${matchId}/messages`, {
        method: 'POST',
        body: JSON.stringify({ body, replyToMessageId }),
      }),
    edit: (matchId: string, messageId: string, body: string) =>
      request<{ message: Message }>(`/matches/${matchId}/messages/${messageId}`, {
        method: 'PATCH',
        body: JSON.stringify({ body }),
      }),
    delete: (matchId: string, messageId: string) =>
      request<{ ok: boolean }>(`/matches/${matchId}/messages/${messageId}`, { method: 'DELETE' }),
  },
  gifts: {
    catalog: () => request<{ gifts: GiftCatalogItem[] }>('/gifts/catalog'),
    checkout: (input: { context: 'chat' | 'discovery'; matchId?: string; targetUserId?: string; giftId: string; note?: string }) =>
      request<{ transactionId: string; invoiceLink: string }>('/gifts/checkout', {
        method: 'POST', body: JSON.stringify(input),
      }),
    transaction: (id: string) =>
      request<{ status: string; introStatus: string | null }>(`/gifts/transactions/${id}`),
    intros: () => request<{ intros: GiftIntro[] }>('/gifts/intros'),
    acceptIntro: (id: string) => request<{ matchId: string }>(`/gifts/intros/${id}/accept`, { method: 'POST' }),
    dismissIntro: (id: string) => request<{ ok: boolean }>(`/gifts/intros/${id}/dismiss`, { method: 'POST' }),
  },
  premium: {
    status: () => request<PremiumStatus>('/premium/status'),
    checkout: (planId: string) =>
      request<{
        transactionId: string
        provider?: 'stars' | 'tonpays'
        invoiceLink?: string
        payment?: TonPaysPaymentInfo
      }>('/premium/checkout', {
        method: 'POST', body: JSON.stringify({ planId }),
      }),
    transaction: (id: string) =>
      request<{
        status: string
        provider?: 'stars' | 'tonpays'
        tonpaysStatus?: string | null
        remainingAmount?: number | null
        refundPending?: boolean
      }>(`/premium/transactions/${id}`),
    changeCard: (id: string) =>
      request<{ cardNumber: string; cardHolder: string }>(
        `/premium/transactions/${id}/change-card`, { method: 'POST' }
      ),
    refundCard: (id: string, cardNumber: string, cardHolder: string) =>
      request<{ ok: true }>(`/premium/transactions/${id}/refund-card`, {
        method: 'POST', body: JSON.stringify({ cardNumber, cardHolder }),
      }),
  },
  referrals: {
    me: () => request<ReferralStatus>('/referrals/me'),
  },
  reports: {
    create: (input: {
      reportedUserId: string
      context: 'discovery' | 'chat'
      reason: string
      note?: string
      matchId?: string
    }) => request<{ ok: true }>('/reports', { method: 'POST', body: JSON.stringify(input) }),
  },
  blocks: {
    create: (userId: string) =>
      request<{ ok: true }>('/block', { method: 'POST', body: JSON.stringify({ userId }) }),
  },
  asks: {
    config: () => request<{ enabled: boolean }>('/asks/config'),
    friends: () => request<{ friends: AskFriend[] }>('/asks/friends'),
    removeFriend: (id: string) => request<{ ok: true }>(`/asks/friends/${encodeURIComponent(id)}`, { method: 'DELETE' }),
    create: (input: { targetId: string; question: AskQuestion; memberIds: string[]; linkCount: number }) =>
      request<{ ask: AskSummary; links: string[] }>('/asks', { method: 'POST', body: JSON.stringify(input) }),
    list: () => request<{ asks: AskSummary[] }>('/asks'),
    get: (id: string) => request<AskDetail>(`/asks/${encodeURIComponent(id)}`),
    /** Her ask's person as a Discovery card (to go back to that profile). */
    profile: (id: string) => request<{ profile: DiscoveryProfile }>(`/asks/${encodeURIComponent(id)}/profile`),
    remind: (id: string, recipientId: string) =>
      request<{ ok: true }>(`/asks/${encodeURIComponent(id)}/remind/${encodeURIComponent(recipientId)}`, { method: 'POST' }),
    forMe: (recipientId: string) => request<AskRecipientView>(`/asks/for-me/${encodeURIComponent(recipientId)}`),
    answerForMe: (recipientId: string, verdict: AskVerdict, note?: string) =>
      request<{ ok: true }>(`/asks/for-me/${encodeURIComponent(recipientId)}/answer`, {
        method: 'POST', body: JSON.stringify({ verdict, ...(note ? { note } : {}) }),
      }),
    event: (input: AskEventInput) =>
      request<void>('/asks/events', { method: 'POST', body: JSON.stringify(input) }),
    // Public-by-token link endpoints. Inside Telegram the raw initData rides in
    // Authorization (clientHeaders); `auth: false` resolves anonymously (landing).
    link: (token: string, auth = true) =>
      request<AskLinkState>(askLinkPath(token), undefined, { noAuth: !auth }),
    linkGender: (token: string, gender: 'female' | 'male') =>
      request<AskLinkState>(`${askLinkPath(token)}/gender`, { method: 'POST', body: JSON.stringify({ gender }) }),
    linkAnswer: (token: string, verdict: AskVerdict, note?: string) =>
      request<{ ok: true }>(`${askLinkPath(token)}/answer`, {
        method: 'POST', body: JSON.stringify({ verdict, ...(note ? { note } : {}) }),
      }),
    linkEvent: (token: string, input: AskEventInput) =>
      request<void>(`${askLinkPath(token)}/events`, { method: 'POST', body: JSON.stringify(input) }),
  },
  support: {
    list: () => request<{ tickets: SupportTicketListItem[] }>('/support/tickets'),
    thread: (id: string) => request<SupportThread>(`/support/tickets/${id}`),
    create: (body: string) =>
      request<{ ticket: { id: string; status: 'open' | 'closed'; createdAt: string } }>(
        '/support/tickets', { method: 'POST', body: JSON.stringify({ body }) },
      ),
    reply: (id: string, body: string) =>
      request<{ message: SupportMessage }>(`/support/tickets/${id}/messages`, {
        method: 'POST', body: JSON.stringify({ body }),
      }),
  },
}
