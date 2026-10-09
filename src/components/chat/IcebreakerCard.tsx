import { t } from '../../i18n.js'
import { icebreakerQuestion } from '../../utils/icebreaker.js'
import { Button } from '../ui/index.js'

interface IcebreakerCardProps {
  mine: boolean
  counterpartName: string
  prompt: string
  answer: string | null
  /** Mine only: the other person hasn't sent anything in this chat yet. */
  awaitingAnswer?: boolean
  onAnswer?: () => void
}

/** Centered system-style card for a `type: 'icebreaker'` message — the owner's
 * profile icebreaker auto-posted at match time as an opening question. */
export function IcebreakerCard({ mine, counterpartName, prompt, answer, awaitingAnswer, onAnswer }: IcebreakerCardProps) {
  return (
    <div className="self-center w-full max-w-xs my-2 p-4 rounded-m3-lg bg-primary-container text-on-primary-container text-start">
      <p className="text-[11px] font-bold uppercase tracking-widest mb-1 opacity-70">
        {mine ? t.chat.yourIcebreaker : t.chat.icebreakerOf(counterpartName)}
      </p>
      <p className="text-[13px] opacity-90">{prompt}</p>
      {answer && <p className="text-[15px] font-medium mt-1">“{answer}”</p>}
      <p className="text-[15px] font-bold mt-2">{icebreakerQuestion(prompt)}</p>
      {!mine && onAnswer && (
        <Button variant="filled" size="sm" className="mt-3" onClick={onAnswer}>
          {t.chat.answerIt}
        </Button>
      )}
      {mine && awaitingAnswer && (
        <p className="text-[12px] mt-2 opacity-70">{t.chat.waitingForAnswer(counterpartName)}</p>
      )}
    </div>
  )
}
