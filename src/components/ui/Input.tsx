// Material 3 text field + textarea. Filled (surface) style that turns to the
// `field` fill with a primary border on focus — matching the design mockup.
import type { InputHTMLAttributes, TextareaHTMLAttributes } from 'react'

const base =
  'w-full box-sizing-border border border-transparent bg-surface text-txt outline-none ' +
  'transition-colors placeholder:text-txt3 focus:border-primary focus:bg-field'

export interface InputProps extends InputHTMLAttributes<HTMLInputElement> {}

export function Input({ className = '', ...rest }: InputProps) {
  return (
    <input
      className={[base, 'rounded-m3-md px-4 py-4 text-[16px]', className].join(' ')}
      style={{ boxSizing: 'border-box' }}
      {...rest}
    />
  )
}

export interface TextareaProps extends TextareaHTMLAttributes<HTMLTextAreaElement> {}

export function Textarea({ className = '', ...rest }: TextareaProps) {
  return (
    <textarea
      className={[base, 'rounded-m3-md px-4 py-3.5 text-[14px] resize-none', className].join(' ')}
      style={{ boxSizing: 'border-box' }}
      {...rest}
    />
  )
}
