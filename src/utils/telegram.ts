export function openChat(user: { telegramId: number; username: string | null }) {
  const webApp = window.Telegram?.WebApp

  if (user.username) {
    const url = `https://t.me/${user.username}`
    webApp?.openTelegramLink ? webApp.openTelegramLink(url) : window.open(url, '_blank')
    return
  }

  if (webApp) {
    webApp.showAlert?.("This person hasn't set a Telegram username yet, so we can't open a chat with them.")
    return
  }

  window.location.href = `tg://user?id=${user.telegramId}`
}
