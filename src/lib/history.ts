import type { EncodedContent, HistoryEntry, QrForms, QrSettings } from '../types'
import { redactWifi } from './payload'

export const HISTORY_STORAGE_KEY = 'qrHistory'
export const HISTORY_LIMIT = 30

const isEntry = (value: unknown): value is HistoryEntry =>
  Boolean(value) &&
  typeof value === 'object' &&
  typeof (value as HistoryEntry).id === 'string' &&
  typeof (value as HistoryEntry).text === 'string' &&
  typeof (value as HistoryEntry).createdAt === 'number'

export const sanitizeHistory = (value: unknown): HistoryEntry[] =>
  Array.isArray(value) ? value.filter(isEntry).slice(0, HISTORY_LIMIT) : []

export const PREFS_STORAGE_KEY = 'qrPrefs'

export interface Prefs {
  saveHistory: boolean
}

export const DEFAULT_PREFS: Prefs = { saveHistory: true }

export const sanitizePrefs = (value: unknown): Prefs => ({
  saveHistory:
    value && typeof value === 'object' && typeof (value as Prefs).saveHistory === 'boolean'
      ? (value as Prefs).saveHistory
      : DEFAULT_PREFS.saveHistory,
})

/**
 * Builds the history record for a download or copy. Wi-Fi passwords are never
 * stored: the saved form and payload leave the password out.
 */
export function createEntry(content: EncodedContent, form: QrForms[keyof QrForms], settings: QrSettings, now = Date.now()): HistoryEntry {
  const design = {
    style: settings.style,
    foreground: settings.foreground,
    background: settings.background,
    gradient: settings.gradient,
    gradientTo: settings.gradientTo,
    errorCorrection: settings.errorCorrection,
    margin: settings.margin,
  }
  const base = { id: `${now.toString(36)}-${Math.random().toString(36).slice(2, 8)}`, createdAt: now, type: content.type, label: content.label, design }
  if (content.type === 'wifi') {
    const wifi = form as QrForms['wifi']
    const redacted = redactWifi(wifi)
    return { ...base, text: redacted.text, form: redacted.form, passwordOmitted: wifi.security !== 'nopass' }
  }
  return { ...base, text: content.text, form }
}

/** Newest first; an identical code moves to the top instead of being duplicated. */
export function addEntry(entries: HistoryEntry[], entry: HistoryEntry): HistoryEntry[] {
  return [entry, ...entries.filter((item) => !(item.type === entry.type && item.text === entry.text))].slice(0, HISTORY_LIMIT)
}

export function relativeTime(timestamp: number, now = Date.now()): string {
  const seconds = Math.round((now - timestamp) / 1000)
  if (seconds < 45) return 'Just now'
  const minutes = Math.round(seconds / 60)
  if (minutes < 60) return `${minutes} min ago`
  const hours = Math.round(minutes / 60)
  if (hours < 24) return `${hours} h ago`
  const days = Math.round(hours / 24)
  if (days < 7) return `${days} d ago`
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' })
}
