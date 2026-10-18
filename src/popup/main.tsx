import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { applyTheme, readStoredTheme } from '../hooks/useTheme'
import { App } from './App'
import './fonts.css'
import './styles.css'

// Apply the saved theme before the first paint so the popup never flashes.
applyTheme(readStoredTheme())

// `npm run dev` serves the popup as a normal page; simulate the extension APIs there.
// This branch is removed from production builds.
if (import.meta.env.DEV && !(typeof chrome !== 'undefined' && chrome.runtime?.id)) {
  const { installDevChromeShim } = await import('../dev/chromeShim')
  installDevChromeShim()
}

const root = document.getElementById('root')
if (!root) throw new Error('Popup root element is missing')

createRoot(root).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
