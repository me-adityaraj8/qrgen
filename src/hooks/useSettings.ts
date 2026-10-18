import { useCallback, useEffect, useRef, useState } from 'react'
import { loadSettings, saveSettings } from '../lib/chrome'
import { DEFAULT_SETTINGS } from '../lib/settings'
import type { QrSettings } from '../types'

export interface SettingsController {
  settings: QrSettings
  /** False until stored settings have loaded, so the preview doesn't flash defaults. */
  ready: boolean
  update: (patch: Partial<QrSettings>) => void
  reset: () => void
}

export function useSettings(): SettingsController {
  const [settings, setSettings] = useState<QrSettings>({ ...DEFAULT_SETTINGS })
  const [ready, setReady] = useState(false)
  const loaded = useRef(false)

  useEffect(() => {
    let cancelled = false
    void loadSettings().then((stored) => {
      if (cancelled) return
      loaded.current = true
      setSettings(stored)
      setReady(true)
    })
    return () => {
      cancelled = true
    }
  }, [])

  // Write on every change: the popup can close at any moment, so a debounced
  // write could be lost.
  useEffect(() => {
    if (!loaded.current) return
    saveSettings(settings).catch(() => {
      // Preferences are a convenience; the popup keeps working without them.
    })
  }, [settings])

  const update = useCallback((patch: Partial<QrSettings>) => {
    setSettings((current) => ({ ...current, ...patch }))
  }, [])

  const reset = useCallback(() => setSettings({ ...DEFAULT_SETTINGS }), [])

  return { settings, ready, update, reset }
}
