// Screen 1 — "ask a friend" pick-friends sheet, opened from the Discovery
// action row. Question chip → member friends and/or Telegram links (1–3 in
// total) → POST /asks → share each raw link via Telegram (or copy it).
import { useEffect, useState } from 'react'
import { api } from '../../api.js'
import { t } from '../../i18n.js'
import { relativeTime } from '../../i18n/format.js'
import { haptic, openTelegramLink, telegramFirstName } from '../../telegram.js'
import { useAuthStore } from '../../store.js'
import { Avatar, Button, Chip, Icon, Sheet } from '../ui/index.js'
import type { AskFriend, AskQuestion, AskSummary } from '../../types.js'
import {
  ASK_MAX_RECIPIENTS, ASK_QUESTIONS, copyText, errorBody, questionLabel, shareUrl, showToast, trackAsk,
} from './askUtils.js'

interface Props {
  open: boolean
  target: { id: string; name: string }
  onClose: () => void
  /** The ask was created (links, if any, are being shared). */
  onCreated?: (ask: AskSummary) => void
  /** An ask for this person is already open — show its results instead. */
  onExists?: (askId: string) => void
}

export function AskSheet({ open, target, onClose, onCreated, onExists }: Props) {
  const [question, setQuestion] = useState<AskQuestion>('reply')
  const [friends, setFriends] = useState<AskFriend[]>([])
  const [selected, setSelected] = useState<string[]>([])
  const [linkCount, setLinkCount] = useState(0)
  const [busy, setBusy] = useState(false)
  // After submit with links: the share step.
  const [links, setLinks] = useState<string[] | null>(null)
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null)
  const [created, setCreated] = useState<AskSummary | null>(null)

  // Fresh state on every open.
  useEffect(() => {
    if (!open) return
    setQuestion('reply')
    setSelected([])
    setLinkCount(0)
    setLinks(null)
    setCreated(null)
    setBusy(false)
    let alive = true
    ;(async () => {
      try {
        const res = await api.asks.friends()
        if (alive) setFriends(res.friends ?? [])
      } catch {
        if (alive) setFriends([])
      }
    })()
    return () => { alive = false }
  }, [open])

  useEffect(() => {
    if (copiedIdx == null) return
    const id = setTimeout(() => setCopiedIdx(null), 1600)
    return () => clearTimeout(id)
  }, [copiedIdx])

  const total = selected.length + linkCount
  const full = total >= ASK_MAX_RECIPIENTS
  const requesterName = useAuthStore.getState().user?.name ?? telegramFirstName() ?? ''
  const text = t.ask.shareText(requesterName)

  const toggleFriend = (id: string) => {
    haptic.selection()
    setSelected((s) => (s.includes(id) ? s.filter((x) => x !== id) : s.length + linkCount >= ASK_MAX_RECIPIENTS ? s : [...s, id]))
  }

  const addLink = () => {
    if (full) return
    haptic.selection()
    setLinkCount((n) => n + 1)
  }

  const removeLink = () => {
    haptic.selection()
    setLinkCount((n) => Math.max(0, n - 1))
  }

  const share = (link: string, ask?: AskSummary) => {
    haptic.impact('light')
    openTelegramLink(shareUrl(link, text))
    trackAsk({ name: 'ask_share_opened', requestId: ask?.id, recipientKind: 'link', props: { method: 'telegram' } })
  }

  const copy = async (link: string, idx: number) => {
    haptic.selection()
    await copyText(link)
    setCopiedIdx(idx)
    trackAsk({ name: 'ask_share_opened', requestId: created?.id, recipientKind: 'link', props: { method: 'copy' } })
  }

  const submit = async () => {
    if (busy || total === 0) return
    setBusy(true)
    trackAsk({ name: 'ask_sheet_submit', props: { question, member_count: selected.length, link_count: linkCount } })
    try {
      const res = await api.asks.create({ targetId: target.id, question, memberIds: selected, linkCount })
      haptic.notification('success')
      setCreated(res.ask)
      onCreated?.(res.ask)
      const got = res.links ?? []
      if (got.length === 0) {
        showToast(t.ask.sentToast)
        onClose()
        return
      }
      setLinks(got)
      // Open Telegram's share sheet for the first link straight away.
      share(got[0], res.ask)
    } catch (err) {
      const body = errorBody(err)
      haptic.notification('error')
      if (body.status === 409 && String(body.error).includes('ask_exists')) {
        const askId = (body.askId ?? body.ask_id ?? body.id) as string | undefined
        onClose()
        if (askId) onExists?.(askId)
        return
      }
      if (body.status === 429) showToast(t.ask.limitReached)
      else showToast(t.errors.generic)
    } finally {
      setBusy(false)
    }
  }

  if (links) {
    return (
      <Sheet open={open} onClose={onClose}>
        <div className="flex flex-col gap-4 pb-2" data-testid="ask-share-step">
          <div className="flex flex-col gap-1">
            <h2 className="text-[18px] font-medium leading-tight text-txt">{t.ask.shareTitle}</h2>
            <p className="text-[13px] text-txt2">{t.ask.shareSub}</p>
          </div>
          <div className="flex flex-col rounded-m3-md bg-surface overflow-hidden">
            {links.map((link, i) => (
              <div key={link} className="flex items-center gap-2 px-3.5 py-2.5 min-h-[56px] border-b border-outline last:border-b-0">
                <span className="w-9 h-9 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center flex-none">
                  <Icon name="link" size={18} />
                </span>
                <span className="flex-1 text-[14px] text-txt">{links.length > 1 ? t.ask.shareLinkN(i + 1) : t.ask.linkRowTitle}</span>
                <Button size="sm" variant="tonal" onClick={() => share(link, created ?? undefined)} icon="send">
                  {t.ask.shareButton}
                </Button>
                <button
                  type="button"
                  onClick={() => copy(link, i)}
                  aria-label={t.ask.copyLink}
                  className="h-9 px-3 rounded-full text-[12px] font-medium text-primary hover:bg-[var(--prtint)] flex items-center gap-1"
                >
                  <Icon name={copiedIdx === i ? 'check' : 'copy'} size={16} />
                  {copiedIdx === i ? t.ask.copied : t.ask.copyLink}
                </button>
              </div>
            ))}
          </div>
          <Button block size="lg" onClick={onClose}>{t.ask.done}</Button>
        </div>
      </Sheet>
    )
  }

  return (
    <Sheet open={open} onClose={onClose}>
      <div className="flex flex-col gap-4 pb-2">
        <div className="flex flex-col gap-1">
          <h2 className="text-[18px] font-medium leading-tight text-txt">{t.ask.sheetTitle(target.name)}</h2>
          <p className="text-[13px] text-txt2">{t.ask.sheetPrivacy(target.name)}</p>
        </div>

        <div className="flex flex-col gap-2">
          <div className="text-[12px] text-txt2">{t.ask.questionLabel}</div>
          <div className="flex flex-wrap gap-2" role="radiogroup">
            {ASK_QUESTIONS.map((q) => (
              <Chip
                key={q}
                type="button"
                role="radio"
                aria-checked={question === q}
                selected={question === q}
                onClick={() => { haptic.selection(); setQuestion(q) }}
              >
                {questionLabel(q)}
              </Chip>
            ))}
          </div>
        </div>

        {friends.length > 0 && (
          <div className="flex flex-col gap-2">
            <div className="text-[12px] text-txt2">{t.ask.friendsLabel}</div>
            <div className="flex flex-col rounded-m3-md bg-surface overflow-hidden">
              {friends.map((f) => {
                const checked = selected.includes(f.id)
                return (
                  <label
                    key={f.id}
                    className="flex items-center gap-3 px-3.5 py-2.5 min-h-[52px] border-b border-outline last:border-b-0 cursor-pointer"
                  >
                    <Avatar src={f.photoUrl} size={36} alt={f.name} />
                    <span className="flex-1 flex flex-col min-w-0">
                      <span className="text-[14px] text-txt truncate">{f.name}</span>
                      <span className="text-[12px] text-txt2">{relativeTime(f.lastInteractionAt)}</span>
                    </span>
                    <input
                      type="checkbox"
                      checked={checked}
                      disabled={!checked && full}
                      onChange={() => toggleFriend(f.id)}
                      className="w-5 h-5 accent-[var(--pr)]"
                      aria-label={f.name}
                    />
                  </label>
                )
              })}
            </div>
          </div>
        )}

        <div
          className={`flex items-center gap-3 min-h-[56px] px-3.5 py-2.5 rounded-m3-md border border-dashed border-outline-variant bg-bg ${full ? 'opacity-60' : ''}`}
        >
          <button
            type="button"
            onClick={addLink}
            disabled={full}
            className="flex-1 flex items-center gap-3 text-start disabled:cursor-not-allowed"
            data-testid="ask-add-link"
          >
            <span className="w-9 h-9 rounded-full bg-primary-container text-on-primary-container flex items-center justify-center flex-none">
              <Icon name="plus" size={18} />
            </span>
            <span className="flex-1 flex flex-col min-w-0">
              <span className="text-[14px] text-txt">{t.ask.linkRowTitle}</span>
              <span className="text-[12px] text-txt2">{full ? t.ask.maxRecipients : t.ask.linkRowSub}</span>
            </span>
          </button>
          {linkCount > 0 && (
            <span className="flex items-center gap-1.5 flex-none">
              <span className="text-[12px] font-medium text-on-primary-container bg-primary-container rounded-full px-2.5 h-7 flex items-center">
                {t.ask.linkCount(linkCount)}
              </span>
              <button
                type="button"
                onClick={removeLink}
                aria-label={t.ask.removeLink}
                className="w-7 h-7 rounded-full bg-surface text-txt2 flex items-center justify-center"
              >
                <Icon name="minus" size={14} />
              </button>
            </span>
          )}
        </div>

        <Button block size="lg" onClick={submit} disabled={busy || total === 0}>
          {busy ? t.ask.sending : total === 0 ? t.ask.submitEmpty : t.ask.submit(total)}
        </Button>
      </div>
    </Sheet>
  )
}
