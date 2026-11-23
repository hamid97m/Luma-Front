import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi, beforeEach } from 'vitest'
import { api } from '../src/api.js'
import { Onboarding } from '../src/screens/Onboarding.js'

const clickContinue = () => fireEvent.click(screen.getByRole('button', { name: 'ادامه' }))

async function goToGenderStep() {
  fireEvent.change(screen.getByPlaceholderText('تینا'), { target: { value: 'Sara' } })
  clickContinue()
  fireEvent.change(await screen.findByPlaceholderText('تهران'), { target: { value: 'شیراز' } })
  clickContinue()
  fireEvent.change(screen.getByPlaceholderText('25'), { target: { value: '25' } })
  clickContinue()
}

describe('Onboarding gender confirmation', () => {
  beforeEach(() => {
    vi.clearAllMocks()
    vi.mocked(api.profile.checkText).mockResolvedValue({ ok: true })
  })

  it('shows a persistent "cannot change later" hint under the options', async () => {
    render(<Onboarding onComplete={vi.fn()} />)
    await goToGenderStep()
    expect(screen.getByText('بعداً قابل تغییر نیست')).toBeTruthy()
  })

  it('asks to confirm the chosen gender and stays on the step when they want to change it', async () => {
    render(<Onboarding onComplete={vi.fn()} />)
    await goToGenderStep()
    fireEvent.click(screen.getByText('مرد'))
    clickContinue()

    expect(screen.getByText('مطمئنی؟')).toBeTruthy()
    expect(screen.getByText('جنسیتت رو «مرد» انتخاب کردی. بعد از ثبت‌نام دیگه قابل تغییر نیست.')).toBeTruthy()

    fireEvent.click(screen.getByRole('button', { name: 'تغییر می‌دم' }))
    expect(screen.queryByText('مطمئنی؟')).toBeNull()
    // Still on the gender step, free to pick another option.
    fireEvent.click(screen.getByText('زن'))
    clickContinue()
    expect(screen.getByText('جنسیتت رو «زن» انتخاب کردی. بعد از ثبت‌نام دیگه قابل تغییر نیست.')).toBeTruthy()
  })

  it('moves on to the next step once confirmed', async () => {
    render(<Onboarding onComplete={vi.fn()} />)
    await goToGenderStep()
    fireEvent.click(screen.getByText('زن'))
    clickContinue()
    fireEvent.click(screen.getByRole('button', { name: 'بله، درسته' }))

    expect(screen.queryByText('مطمئنی؟')).toBeNull()
    expect(screen.getByText('همه')).toBeTruthy() // looking-for options
  })
})
