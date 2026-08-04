import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Mock scrollIntoView
Element.prototype.scrollIntoView = vi.fn()

// Mock Telegram WebApp global
Object.assign(window, {
  Telegram: {
    WebApp: {
      initData: 'mock_init_data',
      initDataUnsafe: {
        user: { id: 123, first_name: 'Ali', username: 'ali' },
      },
      ready: vi.fn(),
      expand: vi.fn(),
      close: vi.fn(),
    },
  },
})

vi.mock('@telegram-apps/sdk-react', () => ({
  useRawInitData: () => 'mock_init_data',
  useLaunchParams: () => ({
    tgWebAppData: undefined,
    tgWebAppPlatform: 'tdesktop',
    tgWebAppVersion: '7.0',
    tgWebAppThemeParams: {},
  }),
}))

vi.mock('../src/api.ts', () => ({
  api: {
    auth: { verify: vi.fn() },
    profile: { get: vi.fn(), update: vi.fn(), setWriteAccess: vi.fn(() => Promise.resolve({ ok: true })) },
    photos: { getUploadUrl: vi.fn(), delete: vi.fn(), reorder: vi.fn(), upload: vi.fn(), uploadFile: vi.fn() },
    discovery: { feed: vi.fn() },
    swipes: { swipe: vi.fn() },
    matches: { list: vi.fn(), unreadCount: vi.fn() },
    messages: { list: vi.fn(), send: vi.fn() },
  },
}))
