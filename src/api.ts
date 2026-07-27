import type { UserProfile, DiscoveryProfile, Match, SwipeResult } from './types.js'

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
      request<{ uploadUrl: string; publicUrl: string; photoId: string }>(
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
    uploadFile: async (file: File): Promise<string> => {
      const { uploadUrl, publicUrl } = await api.photos.getUploadUrl(file.type)
      await fetch(uploadUrl, { method: 'PUT', body: file, headers: { 'Content-Type': file.type } })
      return publicUrl
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
