import { useEffect } from 'react'

interface Props {
  onDone: () => void
}

export function Splash({ onDone }: Props) {
  useEffect(() => {
    const id = setTimeout(onDone, 2000)
    return () => clearTimeout(id)
  }, [onDone])

  return (
    <div
      className="flex flex-col items-center justify-center h-screen gap-3 relative overflow-hidden"
      style={{ background: 'radial-gradient(120% 90% at 50% 10%, #f43f5e 0%, #ec4067 34%, #a855f7 100%)' }}
    >
      <div className="text-[96px] animate-pulse-heart select-none">💖</div>
      <h1 className="text-[36px] font-extrabold text-white tracking-tight">Spark</h1>
      <p className="text-[14px] text-white/80">Find your person</p>
      <div className="absolute bottom-16 flex gap-2">
        {[0, 1, 2].map((i) => (
          <div
            key={i}
            className="w-2 h-2 rounded-full bg-white/60 animate-pulse"
            style={{ animationDelay: `${i * 0.18}s` }}
          />
        ))}
      </div>
    </div>
  )
}
