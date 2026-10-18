import { useCallback, useEffect, useRef, useState } from 'react'
import { Header, viewPanelId, viewTabId, type View } from '../components/Header'
import { SettingsMenu } from '../components/SettingsMenu'
import { Toast, type ToastMessage } from '../components/Toast'
import { useActiveTab } from '../hooks/useActiveTab'
import { useGenerator, type Notify } from '../hooks/useGenerator'
import { useSettings } from '../hooks/useSettings'
import { useShortcut } from '../hooks/useShortcut'
import { useStoredState } from '../hooks/useStoredState'
import { useTheme } from '../hooks/useTheme'
import { addEntry, DEFAULT_PREFS, HISTORY_STORAGE_KEY, PREFS_STORAGE_KEY, sanitizeHistory, sanitizePrefs } from '../lib/history'
import { LOGO_STORAGE_KEY, LogoError, readLogoFile, sanitizeLogo } from '../lib/logo'
import type { HistoryEntry } from '../types'
import { AboutView } from '../views/AboutView'
import { GeneratorView } from '../views/GeneratorView'
import { HistoryView } from '../views/HistoryView'

const TOAST_MS = { success: 3200, neutral: 3200, error: 7000 }
const NO_HISTORY: HistoryEntry[] = []

export function App() {
  const tab = useActiveTab()
  const { settings, ready: settingsReady, update: updateSettings, reset: resetSettings } = useSettings()
  const shortcut = useShortcut()
  const { theme, setTheme } = useTheme()
  const [logo, setLogo, logoReady] = useStoredState<string | null>(LOGO_STORAGE_KEY, null, sanitizeLogo)
  const [history, setHistory] = useStoredState(HISTORY_STORAGE_KEY, NO_HISTORY, sanitizeHistory)
  const [prefs, setPrefs] = useStoredState(PREFS_STORAGE_KEY, DEFAULT_PREFS, sanitizePrefs)
  const [view, setView] = useState<View>('generator')
  const [toast, setToast] = useState<ToastMessage>(null)
  const toastTimer = useRef<ReturnType<typeof setTimeout>>(undefined)

  const notify = useCallback<Notify>((tone, text) => {
    clearTimeout(toastTimer.current)
    setToast({ id: Date.now(), tone, text })
    toastTimer.current = setTimeout(() => setToast(null), TOAST_MS[tone])
  }, [])

  useEffect(() => () => clearTimeout(toastTimer.current), [])

  const generator = useGenerator({
    tab,
    settings,
    settingsReady: settingsReady && logoReady,
    updateSettings,
    logoSrc: logo,
    notify,
    onRecord: (entry) => {
      if (prefs.saveHistory) setHistory((entries) => addEntry(entries, entry))
    },
  })

  const handleLogoUpload = async (file: File) => {
    try {
      setLogo(await readLogoFile(file))
      if (settings.errorCorrection !== 'H') {
        updateSettings({ errorCorrection: 'H' })
        notify('neutral', 'Error correction set to H so the code still scans with a logo.')
      } else {
        notify('success', 'Logo added')
      }
    } catch (error) {
      notify('error', error instanceof LogoError ? error.message : "Couldn't add that logo.")
    }
  }

  const resetAll = () => {
    resetSettings()
    setLogo(null)
    notify('neutral', 'All settings restored to defaults')
  }

  return (
    <div className="app">
      <div className="ambient" aria-hidden="true" />
      <Header
        view={view}
        onViewChange={setView}
        historyCount={history.length}
        theme={theme}
        onThemeChange={setTheme}
        settings={
          <SettingsMenu
            saveHistory={prefs.saveHistory}
            onSaveHistoryChange={(saveHistory) => setPrefs({ saveHistory })}
            historyCount={history.length}
            onClearHistory={() => setHistory([])}
            onResetAll={resetAll}
            shortcut={shortcut}
          />
        }
      />

      <main className="main">
        <div role="tabpanel" id={viewPanelId('generator')} aria-labelledby={viewTabId('generator')} hidden={view !== 'generator'} className="view">
          <GeneratorView
            generator={generator}
            settings={settings}
            ready={settingsReady && logoReady}
            logo={logo}
            onSettingsChange={updateSettings}
            onReset={() => {
              resetSettings()
              setLogo(null)
            }}
            onLogoUpload={(file) => void handleLogoUpload(file)}
            onLogoRemove={() => setLogo(null)}
          />
        </div>
        <div role="tabpanel" id={viewPanelId('history')} aria-labelledby={viewTabId('history')} hidden={view !== 'history'} className="view">
          <HistoryView
            entries={history}
            enabled={prefs.saveHistory}
            onEnable={() => setPrefs({ saveHistory: true })}
            onRestore={(entry) => {
              generator.restore(entry)
              setView('generator')
            }}
            onRemove={(id) => setHistory((entries) => entries.filter((entry) => entry.id !== id))}
            onClear={() => setHistory([])}
          />
        </div>
        <div role="tabpanel" id={viewPanelId('about')} aria-labelledby={viewTabId('about')} hidden={view !== 'about'} className="view">
          <AboutView shortcut={shortcut} />
        </div>
      </main>

      <Toast toast={toast} onDismiss={() => setToast(null)} />
      <div className="sr-only" role="status" aria-live="polite">
        {generator.announcement}
      </div>
    </div>
  )
}
