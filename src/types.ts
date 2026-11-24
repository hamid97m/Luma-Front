import type { Locale } from './i18n/locale.js'

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
  paused?: boolean
  /** Saved UI language; `null` for a brand-new user who hasn't picked one yet. */
  locale?: Locale | null
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
  nearby?: boolean
  /** True when this person's premium is currently active. */
  premium?: boolean
  /** A direct chat to this person needs an opener (it becomes a message request). */
  messageRequest?: boolean
  /** Present when the viewer has an open "ask a friend" request about this candidate. */
  ask?: CandidateAsk
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
    premium?: boolean
    /** Has a live connection right now (GET /matches). */
    online?: boolean
  }
  lastMessage: {
    id?: string
    body: string
    createdAt: string
    senderId: string
    type?: 'text' | 'gift' | 'icebreaker'
    /** When the counterpart read it (meaningful for my own last message). */
    readAt?: string | null
  } | null
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
  premium?: boolean
}

/** A locked liker exposes only a photo (rendered blurred) — no identity. */
export interface LockedLiker {
  photo: string | null
}

export interface LikesResponse {
  visible: LikerProfile[]
  locked: LockedLiker[]
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
  /** Toman price — present only when `PremiumStatus.paymentProvider` is 'tonpays'. */
  priceToman?: number
  /** Pre-discount Toman price; null unless this plan is currently discounted. */
  originalPriceToman?: number | null
}

export interface PremiumStatus {
  enabled: boolean
  premiumUntil: string | null
  /** Which checkout flow applies to this user — resolved server-side (geo). */
  paymentProvider?: 'stars' | 'tonpays'
  plans: PremiumPlan[]
}

/** TonPays card-to-card payment instructions returned by `/premium/checkout`. */
export interface TonPaysPaymentInfo {
  cardNumber: string
  cardHolder: string
  amountToman: number
  invoiceId: string
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

/** A message request waiting for my decision (GET /requests). */
export interface MessageRequest {
  id: string
  body: string
  createdAt: string
  user: Omit<LikerProfile, 'likedAt' | 'telegramId'>
}

/** My own request, still waiting for an answer (GET /requests/sent). */
export interface SentRequest {
  id: string
  body: string
  createdAt: string
  user: { id: string; name: string; photo: string | null }
}

/** POST /discovery/direct-chat: a chat opened right away, or a request now waits for its recipient. */
export interface DirectChatResult {
  created?: boolean
  match?: { id: string; matchedAt: string; user: { id: string; name: string; telegramId?: number; username?: string | null } }
  request?: { id: string; status: 'pending' }
  directChat?: { remaining: number; resetAt: string | null }
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
  type: 'text' | 'gift' | 'icebreaker'
  gift?: { emoji: string | null; starCost: number } | null
  /** The owner's icebreaker answer on a `type: 'icebreaker'` message (`body` is the prompt). */
  icebreakerAnswer?: string | null
}

/** A chat message plus optional client-only delivery state for optimistic send. */
export interface LocalMessage extends Message {
  status?: 'sending' | 'failed'
}

export interface SwipeResult {
  matched: boolean
  match?: {
    id: string
    user: { id: string; name: string; telegramId: number; username: string | null; premium?: boolean }
  }
  swipeLimit?: { remaining: number; resetAt: string }
}

export interface SwipeLimitStatus {
  limited: boolean
  resetAt: string | null
}

export interface DirectChatStatus {
  gate: 'free' | 'paywall' | 'quota'
  remaining: number
  limit: number
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

export interface ReferralMilestone {
  count: number
  rewardType: 'swipes' | 'premium_days'
  rewardAmount: number
  achieved: boolean
  granted: boolean
}

export interface ReferralStatus {
  enabled: boolean
  code: string | null
  link: string | null
  qualifiedCount: number
  totalCount: number
  milestones: ReferralMilestone[]
}

// ---------------------------------------------------------------------------
// Ask a friend ("نظر دوستت رو بپرس") — contract shared with backend/src/routes asks.
// ---------------------------------------------------------------------------
export type AskQuestion = 'reply' | 'date' | 'red_flag'
export type AskVerdict = 'yes' | 'unsure' | 'no'
export type AskStatus = 'open' | 'closed' | 'expired'

/** Compact ask state attached to a discovery candidate (requester's own asks only). */
export interface CandidateAsk {
  id: string
  status: AskStatus
  answered: number
  total: number
  yes: number
  /** Picks the badge's "yes" wording (defaults to 'reply' if absent). */
  question?: AskQuestion
}

export interface AskSummary {
  id: string
  targetId: string
  targetName: string
  targetPhotoUrl: string | null
  question: AskQuestion
  status: AskStatus
  createdAt: string
  expiresAt: string
  total: number
  answered: number
  yes: number
  unsure: number
  no: number
}

export interface AskRecipient {
  id: string
  kind: 'member' | 'link'
  /** Member name or the link advisor's Telegram first name; null = link not opened yet. */
  displayName: string | null
  status: 'unseen' | 'seen' | 'answered'
  verdict: AskVerdict | null
  note: string | null
  answeredAt: string | null
  canRemind: boolean
  /** A second Telegram account tried to open this (locked) link. */
  foreignOpen: boolean
}

export interface AskDetail extends AskSummary {
  target: { id: string; name: string; age: number; photoUrl: string | null }
  recipients: AskRecipient[]
}

export interface AskFriend {
  id: string
  name: string
  photoUrl: string | null
  lastInteractionAt: string
}

export interface AskRecipientView {
  recipientId: string
  requesterName: string
  requesterPhotoUrl: string | null
  question: AskQuestion
  status: AskStatus
  /** Short per-recipient code drawn faintly over the photos. */
  watermark: string
  /** The viewer has a Luma account (drives "back to Luma" vs "try Luma yourself"). */
  isMember: boolean
  profile: {
    name: string
    age: number
    location: string | null
    bio: string | null
    interests: string[]
    photos: string[]
    verified?: boolean
  }
  myAnswer: { verdict: AskVerdict; note: string | null; answeredAt: string; editableUntil: string } | null
}

export type AskLinkState =
  | { state: 'landing'; requesterName: string; question: AskQuestion }
  | { state: 'need_gender'; requesterName: string; question: AskQuestion }
  | { state: 'not_for_you' }
  | { state: 'taken' }
  | { state: 'closed' }
  | { state: 'invalid' }
  | { state: 'ready'; view: AskRecipientView }
