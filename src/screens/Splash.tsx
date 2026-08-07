import { useEffect } from 'react'
import { Icon } from '../components/ui'

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

export function Splash({ onDone }: Props) {
  useEffect(() => {
    const id = setTimeout(onDone, 2000)
    return () => clearTimeout(id)
  }, [onDone])

  return (
    <div
      className="flex flex-col items-center justify-center h-screen gap-4 relative overflow-hidden"
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

      {/* Logo tile */}
      <div
        className="w-24 h-24 rounded-m3-xl flex items-center justify-center"
        style={{ background: 'rgba(255,255,255,.16)', animation: 'lumaBeat 1.6s ease-in-out infinite' }}
      >
        <Icon name="heart" size={44} className="text-white" />
      </div>

      <h1 className="text-[40px] font-medium text-white">Luma</h1>
      <p className="text-[14px] text-white/85">Find your person</p>

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
