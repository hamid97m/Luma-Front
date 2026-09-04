import type { UserProfile, DiscoveryProfile, Match, Message, SwipeResult, SupportTicketListItem, SupportThread, SupportMessage, GiftCatalogItem, GiftIntro, PremiumStatus, SwipeLimitStatus, LikesResponse, DirectChatStatus } from './types.js'
import { compressImage } from './utils/compress.js'

const BASE = import.meta.env.VITE_API_URL as string

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const initData = window.Telegram?.WebApp?.initData ?? ''
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    keepalive: true,
    headers: {
      'Content-Type': 'application/json',
      Authorization: initData,
      ...options?.headers,
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw Object.assign(new Error(text), { status: res.status })
  }
  return res.json() as Promise<T>
}

function putWithProgress(url: string, blob: Blob, onProgress?: (pct: number) => void): Promise<void> {
  return new Promise((resolve, reject) => {
    const xhr = new XMLHttpRequest()
    xhr.open('PUT', url)
    xhr.setRequestHeader('Content-Type', 'image/jpeg')
    xhr.upload.onprogress = (e) => {
      if (e.lengthComputable) onProgress?.(Math.round((e.loaded / e.total) * 100))
    }
    xhr.onload = () => {
      if (xhr.status >= 200 && xhr.status < 300) resolve()
      else reject(new Error(`storage_put_failed: ${xhr.status}`))
    }
    xhr.onerror = () => reject(new Error('storage_put_failed'))
    xhr.send(blob)
  })
}

export const api = {
  auth: {
    verify: (initData: string) =>
      request<{ user: Pick<UserProfile, 'id' | 'name' | 'setupComplete' | 'paused'> | UserProfile }>(
        '/auth/verify',
        { method: 'POST', body: JSON.stringify({ initData }) }
      ),
  },
  profile: {
    get: () => request<UserProfile>('/profile/me'),
    update: (data: Partial<Omit<UserProfile, 'id' | 'photos' | 'setupComplete'>>) =>
      request<UserProfile>('/profile/me', { method: 'PUT', body: JSON.stringify(data) }),
    delete: () => request<{ ok: boolean }>('/profile/me', { method: 'DELETE' }),
    setWriteAccess: (granted: boolean) =>
      request<{ ok: boolean }>('/profile/me/write-access', {
        method: 'POST',
        body: JSON.stringify({ granted }),
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
    reorder: (order: string[]) =>
      request<{ ok: boolean }>('/profile/me/photos/reorder', {
        method: 'PATCH',
        body: JSON.stringify({ order }),
      }),
    upload: async (
      file: File,
      onProgress?: (pct: number) => void
    ): Promise<{ id: string; url: string; position: number }> => {
      const blob = await compressImage(file)
      const { uploadUrl, photoId } = await api.photos.getUploadUrl('image/jpeg')
      await putWithProgress(uploadUrl, blob, onProgress)
      const { photo } = await api.photos.confirm(photoId)
      return photo
    },
    // Swap an existing photo for a freshly uploaded one, keeping its position.
    replace: async (
      oldPhotoId: string,
      file: File,
      onProgress?: (pct: number) => void
    ): Promise<{ id: string; url: string; position: number }> => {
      const blob = await compressImage(file)
      const { uploadUrl, photoId: newPhotoId } = await api.photos.getUploadUrl('image/jpeg', oldPhotoId)
      await putWithProgress(uploadUrl, blob, onProgress)
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
    start: (targetUserId: string) =>
      request<{ created: boolean; match: { id: string; user: { id: string; name: string; telegramId: number; username: string | null } } }>(
        '/discovery/direct-chat',
        { method: 'POST', body: JSON.stringify({ targetUserId }) },
      ),
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
    list: (matchId: string) => request<{ messages: Message[] }>(`/matches/${matchId}/messages`),
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
      request<{ transactionId: string; invoiceLink: string }>('/premium/checkout', {
        method: 'POST', body: JSON.stringify({ planId }),
      }),
    transaction: (id: string) => request<{ status: string }>(`/premium/transactions/${id}`),
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
