import { LOCALES, messagesFor, t } from '../i18n.js'

/** The opening question for a stored icebreaker prompt, in the viewer's
 * locale. The prompt is saved verbatim in its owner's locale, so it's looked
 * up in every locale's (index-aligned) prompt list; custom prompts get the
 * generic question. */
export function icebreakerQuestion(prompt: string | null | undefined): string {
  const key = prompt?.trim()
  if (key) {
    for (const locale of LOCALES) {
      const idx = messagesFor(locale).icebreakers.findIndex((i) => i.prompt === key)
      if (idx !== -1) return t.icebreakers[idx].question
    }
  }
  return t.chat.icebreakerFallbackQuestion
}
