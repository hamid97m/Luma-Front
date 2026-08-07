// Temporary dev-only harness: mounts the real PaywallSheet with seeded premium
// plans so the redesigned paywall can be exercised outside Telegram.
// Not part of the app build — served only by `pnpm dev` at /paywall-dev.html.
import { StrictMode, useState } from 'react'
import { createRoot } from 'react-dom/client'
import { PaywallSheet } from './components/premium/PaywallSheet.js'
import { usePremiumStore } from './store.js'
import type { PremiumStatus } from './types.js'
import './index.css'

const status: PremiumStatus = {
  enabled: true,
  premiumUntil: null,
  plans: [
    {
      id: 'w',
      title: '1 week',
      description: 'A quick taste of Premium',
      priceStars: 150,
      discountPercent: null,
      originalPriceStars: null,
      durationDays: 7,
      discountEndsAt: null,
    },
    {
      id: 'm',
      title: '1 month',
      description: 'Most popular way to start',
      priceStars: 450,
      discountPercent: null,
      originalPriceStars: null,
      durationDays: 30,
      discountEndsAt: null,
    },
    {
      id: 'q',
      title: '3 months',
      description: 'All of Premium at the lowest rate',
      priceStars: 990,
      discountPercent: 34,
      originalPriceStars: 1500,
      durationDays: 90,
      discountEndsAt: new Date(Date.now() + 5 * 3600_000).toISOString(),
    },
  ],
}

// Seed the store and stub refresh so the sheet never hits the real API.
usePremiumStore.setState({ status, refresh: async () => {} })

function Harness() {
  const [open, setOpen] = useState(true)
  const [dark, setDark] = useState(false)
  const toggleDark = () => {
    document.documentElement.setAttribute('data-theme', dark ? 'light' : 'dark')
    setDark(!dark)
  }
  return (
    <div className="h-screen bg-bg text-txt flex flex-col items-center justify-center gap-3">
      <button className="btn-primary max-w-xs" onClick={() => setOpen(true)}>Open paywall</button>
      <button className="btn-primary max-w-xs" onClick={toggleDark}>Toggle dark</button>
      <PaywallSheet open={open} onClose={() => setOpen(false)} />
    </div>
  )
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <Harness />
  </StrictMode>
)
