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
      request<{ uploadUrl: string; photoId: string }>(
        '/profile/me/photos/upload-url',
        { method: 'POST', body: JSON.stringify({ contentType }) }
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
    upload: async (file: File): Promise<{ id: string; url: string; position: number }> => {
      console.log('[upload] step 1: compressing', file.name, file.type, file.size)
      const blob = await compressImage(file)
      console.log('[upload] step 2: compressed to', blob.size, 'bytes')
      const { uploadUrl, photoId } = await api.photos.getUploadUrl('image/jpeg')
      console.log('[upload] step 3: got uploadUrl, photoId=', photoId)
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        body: blob,
        headers: { 'Content-Type': 'image/jpeg' },
      })
      console.log('[upload] step 4: PUT status', putRes.status, putRes.ok)
      if (!putRes.ok) {
        const putErr = await putRes.text()
        throw new Error(`storage PUT failed ${putRes.status}: ${putErr}`)
      }
      const { photo } = await api.photos.confirm(photoId)
      console.log('[upload] step 5: confirmed', photo)
      return photo
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
