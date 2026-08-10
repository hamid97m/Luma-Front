import { useEffect, useState } from 'react'
import { Icon } from '../components/ui'
import { t } from '../i18n'

interface Props {
  onDone: () => void
}

// Floating heart specs matching the mockup splash scene (white-on-brand
// overlay — the allowed literal-color exception).
const HEARTS = [
  { size: 18, left: '14%', bottom: 60, opacity: 0.55, dur: 5.5, delay: 0 },
  { size: 26, left: '32%', bottom: 40, opacity: 0.4, dur: 6.8, delay: 1.2 },
  { size: 14, left: '55%', bottom: 80, opacity: 0.6, dur: 4.8, delay: 2.1 },
  { size: 22, left: '72%', bottom: 50, opacity: 0.45, dur: 6.2, delay: 0.6 },
  { size: 16, left: '86%', bottom: 70, opacity: 0.5, dur: 5.2, delay: 3 },
]

// Mockup timings: a new message every 2.2s. The splash minimum stays just past
// the first rotation so a text change is always seen, even on instant auth.
const MSG_INTERVAL = 2200
const MIN_DURATION = 2600

function shuffle<T>(items: readonly T[]): T[] {
  const a = [...items]
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(Math.random() * (i + 1))
    ;[a[i], a[j]] = [a[j], a[i]]
  }
  return a
}

export function Splash({ onDone }: Props) {
  const [messages] = useState(() => shuffle(t.splash.messages))
  const [current, setCurrent] = useState(0)
  const [prev, setPrev] = useState<number | null>(null)

  useEffect(() => {
    const id = setTimeout(onDone, MIN_DURATION)
    return () => clearTimeout(id)
  }, [onDone])

  useEffect(() => {
    const id = setInterval(() => {
      setCurrent((c) => {
        setPrev(c)
        return (c + 1) % messages.length
      })
    }, MSG_INTERVAL)
    return () => clearInterval(id)
  }, [messages])

  return (
    <div
      className="flex flex-col items-center justify-center h-full gap-4 relative overflow-hidden"
      style={{ background: 'linear-gradient(165deg, var(--pr) 0%, #8C2E68 60%, #5E2A62 100%)' }}
    >
      {/* Floating hearts */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {HEARTS.map((h, i) => (
          <Icon
            key={i}
            name="heart"
            size={h.size}
            className="absolute text-white"
            style={{
              left: h.left,
              bottom: h.bottom,
              opacity: h.opacity,
              animation: `lumaFloat ${h.dur}s linear ${h.delay}s infinite`,
            }}
          />
        ))}
      </div>

      {/* Luma brand icon, beating like the mockup's heart */}
      <img
        src="/luma-icon.png"
        alt="Luma"
        className="w-24 h-24 rounded-m3-xl select-none"
        style={{ boxShadow: '0 12px 32px rgba(0,0,0,.3)', animation: 'lumaBeat 1.6s ease-in-out infinite' }}
      />

      <h1 className="text-[40px] font-medium text-white">Luma</h1>

      {/* Rotating taglines — shuffled per launch, cross-fading in place */}
      <div className="relative w-full h-11 flex-none">
        {messages.map((m, i) => (
          <p
            key={m}
            className="absolute inset-0 flex items-start justify-center px-10 text-[14px] leading-[1.45] text-center text-white/90"
            style={
              i === current
                ? { animation: 'lumaMsgIn .5s cubic-bezier(.2,0,0,1) both' }
                : i === prev
                  ? { animation: 'lumaMsgOut .4s ease both' }
                  : { opacity: 0, pointerEvents: 'none' }
            }
          >
            {m}
          </p>
        ))}
      </div>

      {/* Loader dots */}
      <div className="absolute bottom-[72px] flex gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-white"
            style={{ animation: `lumaDot 1.4s ease-in-out ${i * 0.18}s infinite` }}
          />
        ))}
      </div>
    </div>
  )
}
