export interface UserProfile {
  id: string
  name: string
  age: number
  gender: 'man' | 'woman'
  looking_for: 'men' | 'women' | 'both'
  bio: string | null
  photos: Array<{ id: string; url: string; position: number }>
  setupComplete: boolean
}

export interface DiscoveryProfile {
  id: string
  name: string
  age: number
  bio: string | null
  telegramId: number
  photos: string[]
}

export interface Match {
  id: string
  matchedAt: string
  user: {
    id: string
    name: string
    photos: string[]
    telegramId: number
  }
}

export interface SwipeResult {
  matched: boolean
  match?: {
    id: string
    user: { id: string; name: string; telegramId: number }
  }
}
