import { t } from '../i18n.js'

interface Props {
  onStart: () => void
}

export function Onboarding({ onStart }: Props) {
  return (
    <div className="flex flex-col items-center justify-center h-screen gap-8 p-6 text-center">
      <div className="text-6xl">💘</div>
      <h1 className="text-3xl font-bold">{t.appName}</h1>
      <p className="text-lg opacity-70">{t.welcomeSubtitle}</p>
      <button
        onClick={onStart}
        className="w-full py-4 rounded-2xl text-lg font-semibold"
        style={{ background: 'var(--tg-theme-button-color)', color: 'var(--tg-theme-button-text-color)' }}
      >
        {t.start}
      </button>
    </div>
  )
}
