import { describe, it, expect, afterEach } from 'vitest'
import { icebreakerPromptLabel, icebreakerQuestion } from '../src/utils/icebreaker.js'
import { useLocaleStore } from '../src/i18n.js'

describe('icebreakerQuestion', () => {
  afterEach(() => useLocaleStore.getState().setLocale('fa'))

  it('resolves a prompt from any locale to the active-locale question', () => {
    useLocaleStore.getState().setLocale('fa')
    expect(icebreakerQuestion('My ideal Friday…')).toBe('جمعه ایده‌آل تو چه شکلی است؟')

    useLocaleStore.getState().setLocale('en')
    expect(icebreakerQuestion('دو حقیقت و یک دروغ…')).toBe('Can you guess which one is the lie?')

    useLocaleStore.getState().setLocale('ar')
    expect(icebreakerQuestion("Green flags I'm looking for…")).toBe('ما العلامات الإيجابية التي تبحث عنها؟')
    expect(icebreakerQuestion('صباح هادئ أم جدول مزدحم؟')).toBe('وأنت — صباح هادئ أم جدول مزدحم؟')
  })

  it('ignores surrounding whitespace in the stored prompt', () => {
    useLocaleStore.getState().setLocale('en')
    expect(icebreakerQuestion('  جمعه ایده‌آل من…\n')).toBe('What does your ideal Friday look like?')
  })

  it('falls back to the generic question for unknown or missing prompts', () => {
    useLocaleStore.getState().setLocale('en')
    expect(icebreakerQuestion('My perfect Sunday')).toBe('What about you?')
    expect(icebreakerQuestion(null)).toBe('What about you?')

    useLocaleStore.getState().setLocale('fa')
    expect(icebreakerQuestion('')).toBe('تو چطور؟')
  })
})

describe('icebreakerPromptLabel', () => {
  afterEach(() => useLocaleStore.getState().setLocale('fa'))

  it('shows a catalog prompt from any locale in the active locale', () => {
    useLocaleStore.getState().setLocale('en')
    expect(icebreakerPromptLabel('جمعه ایده‌آل من…')).toBe('My ideal Friday…')

    useLocaleStore.getState().setLocale('fa')
    expect(icebreakerPromptLabel("Green flags I'm looking for…")).toBe('نشانه‌های مثبتی که دنبالشان هستم…')

    useLocaleStore.getState().setLocale('ar')
    expect(icebreakerPromptLabel('  دو حقیقت و یک دروغ…\n')).toBe('حقيقتان وكذبة…')
  })

  it('shows a custom prompt verbatim', () => {
    useLocaleStore.getState().setLocale('en')
    expect(icebreakerPromptLabel('یکشنبه‌ی ایده‌آلم')).toBe('یکشنبه‌ی ایده‌آلم')
  })
})
