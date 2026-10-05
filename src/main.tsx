import React from 'react'
import ReactDOM from 'react-dom/client'
import { App } from './App.js'
import { useLocaleStore } from './i18n.js'
import './index.css'

// Remount the whole tree on a language switch — rare event, and it means no
// component needs to subscribe to the locale individually.
function Root() {
  const locale = useLocaleStore((s) => s.locale)
  return <App key={locale} />
}

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <Root />
  </React.StrictMode>
)
