/** @type {import('tailwindcss').Config} */
export default {
  content: ['./index.html', './src/**/*.{js,ts,jsx,tsx}'],
  theme: {
    extend: {
      // "Luma Material" tokens — each maps to a CSS var defined in index.css,
      // so `bg-surface text-txt` resolves to the right value in light OR dark
      // (dark = <html data-theme="dark">, set from the Telegram color scheme).
      colors: {
        bg: 'var(--bg)',
        field: 'var(--field)',
        surface: 'var(--sc)',
        'surface-high': 'var(--sch)',
        txt: 'var(--tx)',
        txt2: 'var(--tx2)',
        txt3: 'var(--tx3)',
        primary: 'var(--pr)',
        'primary-hover': 'var(--prh)',
        'primary-container': 'var(--pc)',
        'primary-container-high': 'var(--pch)',
        'on-primary-container': 'var(--onpc)',
        outline: 'var(--ol)',
        'outline-variant': 'var(--ol2)',
        error: 'var(--er)',
        'error-container': 'var(--erc)',
        destructive: 'var(--erbtn)',
        'destructive-hover': 'var(--erbtnh)',
      },
      fontFamily: {
        sans: ['Roboto', 'ui-sans-serif', 'system-ui', 'sans-serif'],
      },
      borderRadius: {
        // Material 3 shape scale used across the redesign.
        'm3-sm': '8px',
        'm3-md': '16px',
        'm3-lg': '20px',
        'm3-xl': '28px',
      },
      boxShadow: {
        'm3-1': '0 1px 3px rgba(0,0,0,.12), 0 6px 16px rgba(0,0,0,.14)',
        'm3-fab': '0 4px 12px rgba(176,41,92,.4)',
      },
    },
  },
  plugins: [],
}
