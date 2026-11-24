// Women's chat hint pointing at the report (flag) button — shown on every chat
// visit until she taps the report control (or the hint) once, then never again.
const REPORT_TOOLTIP_KEY = 'luma_report_tooltip_seen'
const reportTooltipKey = () => `${REPORT_TOOLTIP_KEY}:${window.Telegram?.WebApp?.initDataUnsafe?.user?.id ?? 'web'}`

export function reportTooltipSeen(): boolean {
  try {
    return localStorage.getItem(reportTooltipKey()) === '1'
  } catch {
    return true
  }
}

export function markReportTooltipSeen(): void {
  try {
    localStorage.setItem(reportTooltipKey(), '1')
  } catch { /* not persisted */ }
}
