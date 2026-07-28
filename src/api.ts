import type { UserProfile, DiscoveryProfile, Match, SwipeResult } from './types.js'
import { compressImage } from './utils/compress.js'

const BASE = import.meta.env.VITE_API_URL as string

async function request<T>(path: string, options?: RequestInit): Promise<T> {
  const initData = window.Telegram?.WebApp?.initData ?? ''
  const res = await fetch(`${BASE}${path}`, {
    ...options,
    headers: {
      'Content-Type': 'application/json',
      Authorization: initData,
      ...options?.headers,
    },
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(text)
  }
  return res.json() as Promise<T>
}

export const api = {
  auth: {
    verify: (initData: string) =>
      request<{ user: Pick<UserProfile, 'id' | 'name' | 'setupComplete'> }>(
        '/auth/verify',
        { method: 'POST', body: JSON.stringify({ initData }) }
      ),
  },
  profile: {
    get: () => request<UserProfile>('/profile/me'),
    update: (data: Partial<Omit<UserProfile, 'id' | 'photos' | 'setupComplete'>>) =>
      request<UserProfile>('/profile/me', { method: 'PUT', body: JSON.stringify(data) }),
  },
  photos: {
    getUploadUrl: (contentType: string) =>
      request<{ uploadUrl: string; photoId: string; publicUrl: string }>(
        '/profile/me/photos/upload-url',
        { method: 'POST', body: JSON.stringify({ contentType }) }
      ),
    delete: (photoId: string) =>
      request<{ ok: boolean }>(`/profile/me/photos/${photoId}`, { method: 'DELETE' }),
    reorder: (order: string[]) =>
      request<{ ok: boolean }>('/profile/me/photos/reorder', {
        method: 'PATCH',
        body: JSON.stringify({ order }),
      }),
    upload: async (file: File): Promise<{ id: string; url: string; position: number }> => {
      const blob = await compressImage(file)
      const { uploadUrl, photoId, publicUrl } = await api.photos.getUploadUrl('image/jpeg')
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: blob,
        headers: { 'Content-Type': 'image/jpeg' },
      })
      if (!putRes.ok) throw new Error(`storage_put_failed: ${putRes.status}`)
      // Backend pre-inserts the row on getUploadUrl; fetch real position from profile
      const profile = await api.profile.get()
      const photo = profile.photos.find(p => p.id === photoId)
      return photo ?? { id: photoId, url: publicUrl, position: 0 }
    },
  },
  discovery: {
    feed: () =>
      request<{ profiles: DiscoveryProfile[]; exhausted: boolean }>('/discovery'),
  },
  swipes: {
    swipe: (targetUserId: string, direction: 'like' | 'pass') =>
      request<SwipeResult>('/swipes', {
        method: 'POST',
        body: JSON.stringify({ targetUserId, direction }),
      }),
  },
  matches: {
    list: () => request<{ matches: Match[] }>('/matches'),
  },
}
