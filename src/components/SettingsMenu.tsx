import { Keyboard, RotateCcw, Settings, Trash2 } from 'lucide-react'
import { useId, useRef } from 'react'
import { openShortcutSettings } from '../lib/chrome'
import { Switch } from './ui'

interface SettingsMenuProps {
  saveHistory: boolean
  onSaveHistoryChange: (value: boolean) => void
  historyCount: number
  onClearHistory: () => void
  onResetAll: () => void
  /** See useShortcut: a string, "" when unassigned, null when unavailable. */
  shortcut: string | null
}

/** Gear menu built on the Popover API: light dismiss, Esc and focus return are native. */
export function SettingsMenu({ saveHistory, onSaveHistoryChange, historyCount, onClearHistory, onResetAll, shortcut }: SettingsMenuProps) {
  const id = useId()
  const menu = useRef<HTMLDivElement>(null)
  const close = () => menu.current?.hidePopover?.()

  return (
    <>
      <button type="button" className="icon-button tool-button" popoverTarget={id} aria-label="Settings" title="Settings">
        <Settings size={17} strokeWidth={1.8} />
      </button>
      <div id={id} ref={menu} popover="auto" className="menu" role="dialog" aria-label="Settings">
        <p className="menu-title">Settings</p>
        <div className="menu-section">
          <Switch checked={saveHistory} onChange={onSaveHistoryChange} label="Save history" />
          <p className="menu-note">Keeps codes you download or copy on this device. Wi-Fi passwords are never saved.</p>
        </div>
        {shortcut !== null && (
          <button
            type="button"
            className="menu-item"
            onClick={() => {
              close()
              openShortcutSettings()
            }}
          >
            <Keyboard size={15} strokeWidth={1.8} />
            <span>Keyboard shortcut</span>
            <kbd>{shortcut || 'Not set'}</kbd>
          </button>
        )}
        <button
          type="button"
          className="menu-item"
          disabled={historyCount === 0}
          onClick={() => {
            onClearHistory()
            close()
          }}
        >
          <Trash2 size={15} strokeWidth={1.8} />
          <span>Clear history</span>
        </button>
        <button
          type="button"
          className="menu-item is-danger"
          onClick={() => {
            onResetAll()
            close()
          }}
        >
          <RotateCcw size={15} strokeWidth={1.8} />
          <span>Reset all settings</span>
        </button>
      </div>
    </>
  )
}
