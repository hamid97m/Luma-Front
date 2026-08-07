// Temporary dev-only harness: mounts the real Discovery CardStack with sample
// profiles so the fullscreen PhotoViewer can be exercised outside Telegram.
// Not part of the app build — served only by `pnpm dev` at /photo-viewer-dev.html.
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { CardStack } from './components/CardStack.js'
import type { DiscoveryProfile } from './types.js'
import './index.css'

const profiles: DiscoveryProfile[] = [
  {
    id: 'dev-1',
    name: 'Aria',
    age: 27,
    bio: 'Coffee, hikes, film photography',
    telegramId: 1,
    photos: [
      'https://picsum.photos/seed/luma1/720/1280',
      'https://picsum.photos/seed/luma2/720/1280',
      'https://picsum.photos/seed/luma3/720/1280',
      'https://picsum.photos/seed/luma4/720/1280',
      'https://picsum.photos/seed/luma5/720/1280',
    ],
    interests: ['Photography', 'Hiking', 'Coffee'],
    location: 'Berlin',
  },
  {
    id: 'dev-2',
    name: 'Solo',
    age: 30,
    bio: 'Single photo profile — pager bar should be hidden',
    telegramId: 2,
    photos: ['https://picsum.photos/seed/luma6/720/1280'],
    interests: ['Music'],
    location: 'Lisbon',
  },
]

function Harness() {
  return (
    <div className="h-screen bg-bg">
      <CardStack
        profiles={profiles}
        onLike={() => console.log('[dev] like')}
        onPass={() => console.log('[dev] pass')}
        disabled={false}
      />
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Harness />
  </StrictMode>
)
