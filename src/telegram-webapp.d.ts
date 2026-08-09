// Minimal type declarations for the Telegram WebApp JS SDK loaded via script tag
interface TelegramThemeParams {
  bg_color?: string
  text_color?: string
  hint_color?: string
  link_color?: string
  button_color?: string
  button_text_color?: string
  secondary_bg_color?: string
  header_bg_color?: string
  accent_text_color?: string
  section_bg_color?: string
  section_header_text_color?: string
  subtitle_text_color?: string
  destructive_text_color?: string
}

interface TelegramBackButton {
  isVisible: boolean
  show: () => void
  hide: () => void
  onClick: (callback: () => void) => void
  offClick: (callback: () => void) => void
}

interface TelegramMainButton {
  text: string
  isVisible: boolean
  isActive: boolean
  isProgressVisible: boolean
  setText: (text: string) => void
  show: () => void
  hide: () => void
  enable: () => void
  disable: () => void
  showProgress: (leaveActive?: boolean) => void
  hideProgress: () => void
  onClick: (callback: () => void) => void
  offClick: (callback: () => void) => void
}

interface TelegramHapticFeedback {
  impactOccurred: (style: 'light' | 'medium' | 'heavy' | 'rigid' | 'soft') => void
  notificationOccurred: (type: 'error' | 'success' | 'warning') => void
  selectionChanged: () => void
}

interface TelegramSafeAreaInset {
  top: number
  bottom: number
  left: number
  right: number
}

interface TelegramWebApp {
  initData: string
  initDataUnsafe: {
    user?: {
      id: number
      first_name: string
      username?: string
      allows_write_to_pm?: boolean
    }
  }
  colorScheme: 'light' | 'dark'
  // Client platform: 'android' | 'ios' | 'tdesktop' | 'macos' | 'weba' | 'webk' | 'unigram' | …
  platform?: string
  themeParams: TelegramThemeParams
  BackButton: TelegramBackButton
  MainButton: TelegramMainButton
  HapticFeedback: TelegramHapticFeedback
  isVersionAtLeast: (version: string) => boolean
  safeAreaInset?: TelegramSafeAreaInset
  contentSafeAreaInset?: TelegramSafeAreaInset
  isFullscreen?: boolean
  requestFullscreen: () => void
  exitFullscreen: () => void
  disableVerticalSwipes: () => void
  enableVerticalSwipes: () => void
  // Bot API 6.9+ — absent on older clients
  requestWriteAccess?: (callback?: (granted: boolean) => void) => void
  ready: () => void
  expand: () => void
  close: () => void
  // Chrome color controls — accept a hex string; the *_color variants also
  // accept a theme-param keyword. Absent on older clients.
  setHeaderColor?: (color: string) => void
  setBackgroundColor?: (color: string) => void
  setBottomBarColor?: (color: string) => void
  showAlert: (message: string, callback?: () => void) => void
  onEvent: (event: string, callback: () => void) => void
  offEvent: (event: string, callback: () => void) => void
  openTelegramLink: (url: string) => void
  openLink: (url: string, options?: { try_instant_view?: boolean }) => void
  // Bot API 6.1+ — absent on older clients
  openInvoice?: (url: string, callback?: (status: 'paid' | 'cancelled' | 'failed' | 'pending') => void) => void
}

interface Window {
  Telegram?: {
    WebApp?: TelegramWebApp
  }
}
