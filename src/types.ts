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
    age: number | null
    bio: string | null
    icebreakerPrompt: string | null
    icebreakerAnswer: string | null
  }
  lastMessage: { body: string; createdAt: string; senderId: string } | null
  unreadCount: number
  premiumRequired?: boolean
}

export interface LikerProfile {
  id: string
  name: string
  age: number | null
  bio: string | null
  location: string | null
  interests: string[]
  telegramId: number
  photos: string[]
  likedAt: string
}

export interface LikesResponse {
  visible: LikerProfile[]
  lockedCount: number
  premiumRequired: boolean
}

export interface PremiumPlan {
  id: string
  title: string
  description: string
  priceStars: number
  discountPercent: number | null
  originalPriceStars: number | null
  durationDays: number
  discountEndsAt: string | null
}

export interface PremiumStatus {
  enabled: boolean
  premiumUntil: string | null
  plans: PremiumPlan[]
}

export interface GiftCatalogItem {
  giftId: string
  emoji: string | null
  starCost: number
  chargedStars: number
}

export interface GiftIntro {
  id: string
  buyer: { id: string; name: string; photo: string | null }
  emoji: string | null
  note: string | null
  createdAt: string
}

export interface Message {
  id: string
  senderId: string
  body: string
  createdAt: string
  readAt: string | null
  /** Set when the sender edited the message; optional so pre-existing fixtures remain valid. */
  editedAt?: string | null
  /** Id of the message this one replies to; null/absent when not a reply. */
  replyToMessageId?: string | null
  type: 'text' | 'gift'
  gift?: { emoji: string | null; starCost: number } | null
}

/** A chat message plus optional client-only delivery state for optimistic send. */
export interface LocalMessage extends Message {
  status?: 'sending' | 'failed'
}

export interface SwipeResult {
  matched: boolean
  match?: {
    id: string
    user: { id: string; name: string; telegramId: number; username: string | null }
  }
  swipeLimit?: { remaining: number; resetAt: string }
}

export interface SwipeLimitStatus {
  limited: boolean
  resetAt: string | null
}

export interface SupportMessage {
  id: string
  sender: 'user' | 'admin'
  body: string
  createdAt: string
}

export interface SupportTicketListItem {
  id: string
  status: 'open' | 'closed'
  lastSender: 'user' | 'admin'
  lastMessageAt: string
  createdAt: string
  preview: string
  unread: boolean
}

export interface SupportThread {
  ticket: { id: string; status: 'open' | 'closed'; createdAt: string }
  messages: SupportMessage[]
}
