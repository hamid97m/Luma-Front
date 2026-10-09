import { LOCALES, messagesFor, t } from '../i18n.js'

/** Index of a stored prompt in the (index-aligned) catalog. The prompt is
 * saved verbatim in its owner's locale, so every locale's list is searched;
 * custom or blank prompts give null. */
export function icebreakerPromptIndex(prompt: string | null | undefined): number | null {
  const key = prompt?.trim()
  if (!key) return null
  for (const locale of LOCALES) {
    const idx = messagesFor(locale).icebreakers.findIndex((i) => i.prompt === key)
    if (idx !== -1) return idx
  }
  return null
}

/** The opening question for a stored icebreaker prompt, in the viewer's
 * locale; custom prompts get the generic question. */
export function icebreakerQuestion(prompt: string | null | undefined): string {
  const idx = icebreakerPromptIndex(prompt)
  return idx === null ? t.chat.icebreakerFallbackQuestion : t.icebreakers[idx].question
}

/** The prompt itself in the viewer's locale; custom prompts verbatim. */
export function icebreakerPromptLabel(prompt: string): string {
  const idx = icebreakerPromptIndex(prompt)
  return idx === null ? prompt : t.icebreakers[idx].prompt
}
