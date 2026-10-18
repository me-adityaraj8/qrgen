import { Moon, Sun } from 'lucide-react'
import { useRef, type KeyboardEvent, type ReactNode } from 'react'
import type { Theme } from '../hooks/useTheme'
import { BrandMark } from './BrandMark'

export type View = 'generator' | 'history' | 'about'

const VIEWS: { id: View; label: string }[] = [
  { id: 'generator', label: 'Generator' },
  { id: 'history', label: 'History' },
  { id: 'about', label: 'About' },
]

export const viewTabId = (view: View) => `tab-${view}`
export const viewPanelId = (view: View) => `panel-${view}`

interface HeaderProps {
  view: View
  onViewChange: (view: View) => void
  historyCount: number
  theme: Theme
  onThemeChange: (theme: Theme) => void
  settings: ReactNode
}

export function Header({ view, onViewChange, historyCount, theme, onThemeChange, settings }: HeaderProps) {
  const tabs = useRef<(HTMLButtonElement | null)[]>([])

  // Arrow keys move between tabs (WAI-ARIA tabs pattern with automatic activation).
  const handleKeyDown = (event: KeyboardEvent, index: number) => {
    const delta = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0
    if (!delta) return
    event.preventDefault()
    const next = (index + delta + VIEWS.length) % VIEWS.length
    onViewChange(VIEWS[next]!.id)
    tabs.current[next]?.focus()
  }

  return (
    <header className="topbar">
      <div className="brand">
        <BrandMark />
        <div>
          <h1 className="brand-name">
            QR<span className="brand-accent">Gen</span>
          </h1>
          <p className="brand-tagline">Create beautiful QR codes for any purpose</p>
        </div>
      </div>

      <div className="nav-tabs" role="tablist" aria-label="Sections">
        {VIEWS.map((item, index) => (
          <button
            key={item.id}
            ref={(element) => {
              tabs.current[index] = element
            }}
            type="button"
            role="tab"
            id={viewTabId(item.id)}
            aria-selected={view === item.id}
            aria-controls={viewPanelId(item.id)}
            tabIndex={view === item.id ? 0 : -1}
            className="nav-tab"
            onClick={() => onViewChange(item.id)}
            onKeyDown={(event) => handleKeyDown(event, index)}
          >
            {item.label}
            {item.id === 'history' && historyCount > 0 && <span className="nav-count">{historyCount}</span>}
          </button>
        ))}
      </div>

      <div className="topbar-tools">
        <div className="theme-toggle" role="group" aria-label="Theme">
          <button type="button" aria-label="Light theme" aria-pressed={theme === 'light'} onClick={() => onThemeChange('light')}>
            <Sun size={16} strokeWidth={1.8} />
          </button>
          <button type="button" aria-label="Dark theme" aria-pressed={theme === 'dark'} onClick={() => onThemeChange('dark')}>
            <Moon size={16} strokeWidth={1.8} />
          </button>
        </div>
        {settings}
      </div>
    </header>
  )
}
