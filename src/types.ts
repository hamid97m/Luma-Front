export interface UserProfile {
  id: string
  name: string
  age: number
  gender: 'man' | 'woman' | 'nonbinary'
  looking_for: 'men' | 'women' | 'everyone'
  bio: string | null
  interests: string[]
  location: string | null
  icebreaker_prompt: string | null
  icebreaker_answer: string | null
  is_active: boolean
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
  interests: string[]
  location: string | null
}

export interface Match {
  id: string
  matchedAt: string
  user: {
    id: string
    name: string
    photos: string[]
    telegramId: number
    username: string | null
  }
}

export interface SwipeResult {
  matched: boolean
  match?: {
    id: string
    user: { id: string; name: string; telegramId: number; username: string | null }
  }
}
