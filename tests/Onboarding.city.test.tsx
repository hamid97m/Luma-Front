import { render, screen, fireEvent } from '@testing-library/react'
import { describe, it, expect, vi } from 'vitest'
import { Onboarding } from '../src/screens/Onboarding.js'

describe('Onboarding city step', () => {
  it('asks for a city after the name and blocks continue until it is valid', () => {
    render(<Onboarding onComplete={vi.fn()} />)

    fireEvent.change(screen.getByPlaceholderText('تینا'), { target: { value: 'Ali' } })
    fireEvent.click(screen.getByRole('button', { name: 'ادامه' }))

    expect(screen.getByRole('heading', { name: 'کدوم شهر زندگی می‌کنی؟' })).toBeTruthy()
    const city = screen.getByPlaceholderText('تهران')
    const cont = screen.getByRole('button', { name: 'ادامه' })
    expect(cont).toBeDisabled()

    fireEvent.change(city, { target: { value: 'تهران2' } })
    expect(screen.getByText('اسم شهر نمی‌تواند شامل عدد باشد.')).toBeTruthy()
    expect(cont).toBeDisabled()

    fireEvent.change(city, { target: { value: '  شیراز  ' } })
    expect(cont).not.toBeDisabled()
    fireEvent.click(cont)
    expect(screen.getByRole('heading', { name: 'چند سال داری؟' })).toBeTruthy()
  })
})
