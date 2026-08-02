import '@testing-library/jest-dom'
import { vi } from 'vitest'

// Make window.location.reload configurable for testing
try {
  Object.defineProperty(window.location, 'reload', {
    configurable: true,
    writable: true,
    value: vi.fn(),
  })
} catch (e) {
  // If that fails, try replacing the entire location object
  Object.defineProperty(window, 'location', {
    configurable: true,
    value: {
      reload: vi.fn(),
      href: '',
      origin: 'http://localhost',
      protocol: 'http:',
      host: 'localhost',
      hostname: 'localhost',
      port: '',
      pathname: '/',
      search: '',
      hash: '',
    },
  })
}

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
    profile: { get: vi.fn(), update: vi.fn() },
    photos: { getUploadUrl: vi.fn(), delete: vi.fn(), reorder: vi.fn(), uploadFile: vi.fn() },
    discovery: { feed: vi.fn() },
    swipes: { swipe: vi.fn() },
    matches: { list: vi.fn() },
  },
}))
