import { t } from '../i18n.js'

export function PhotoUploadProgress({
  phase,
  progress,
  onDark = false,
}: {
  phase: 'uploading' | 'finalizing'
  progress: number
  onDark?: boolean
}) {
  const settling = phase === 'finalizing' || progress >= 100
  const track = onDark ? 'bg-white/25' : 'bg-surface-high'
  const fill = onDark ? 'bg-white' : 'bg-primary'
  const label = onDark ? 'text-white' : 'text-txt2'

  if (settling) {
    return (
      <div className="w-full flex flex-col items-center gap-1.5" role="progressbar" aria-valuetext={t.onboarding.savingPhoto}>
        <div className={`w-full h-1.5 rounded-full overflow-hidden ${track}`}>
          <div className={`progress-indeterminate h-full rounded-full ${fill}`} />
        </div>
        <span className={`text-[10px] ${label}`}>{t.onboarding.savingPhoto}</span>
      </div>
    )
  }

  return (
    <div
      className="w-full flex flex-col items-center gap-1.5"
      role="progressbar"
      aria-valuenow={progress}
      aria-valuemin={0}
      aria-valuemax={100}
    >
      <div className={`w-full h-1.5 rounded-full overflow-hidden ${track}`}>
        <div className={`h-full rounded-full ${fill} transition-[width]`} style={{ width: `${progress}%` }} />
      </div>
      <span className={`text-[10px] ${label}`}>{progress}%</span>
    </div>
  )
}
