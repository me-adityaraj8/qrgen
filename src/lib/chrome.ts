/**
 * Thin wrappers around extension APIs. Each one degrades gracefully when the
 * popup runs outside an extension (Vite dev server, unit tests).
 */
import type { ActiveTabState, QrSettings } from '../types'
import { sanitizeSettings } from './settings'
import { unsupportedTabReason } from './url'

export const SETTINGS_STORAGE_KEY = 'qrSettings'
const SHORTCUTS_PAGE = 'chrome://extensions/shortcuts'

const hasChrome = () => typeof chrome !== 'undefined' && Boolean(chrome.runtime?.id)

/**
 * Reads the URL of the tab the popup was opened on. The URL is only visible
 * because `activeTab` is granted when the user clicks the icon or uses the shortcut.
 */
export async function getActiveTabState(): Promise<ActiveTabState> {
  if (!hasChrome() || !chrome.tabs?.query) return { status: 'unavailable' }
  try {
    const [tab] = await chrome.tabs.query({ active: true, currentWindow: true })
    const url = tab?.url || tab?.pendingUrl
    if (!url) return { status: 'unavailable' }
    const reason = unsupportedTabReason(url)
    return reason ? { status: 'unsupported', url, reason } : { status: 'ready', url }
  } catch {
    return { status: 'unavailable' }
  }
}

/** Reads one key from chrome.storage.local; undefined outside an extension or on failure. */
export async function readStorage(key: string): Promise<unknown> {
  if (!hasChrome() || !chrome.storage?.local) return undefined
  try {
    return (await chrome.storage.local.get(key))[key]
  } catch {
    return undefined
  }
}

export async function writeStorage(key: string, value: unknown): Promise<void> {
  if (!hasChrome() || !chrome.storage?.local) return
  await chrome.storage.local.set({ [key]: value })
}

export async function removeStorage(key: string): Promise<void> {
  if (!hasChrome() || !chrome.storage?.local) return
  await chrome.storage.local.remove(key)
}

export function extensionVersion(): string | null {
  return hasChrome() && chrome.runtime.getManifest ? chrome.runtime.getManifest().version : null
}

export async function loadSettings(): Promise<QrSettings> {
  if (!hasChrome() || !chrome.storage?.local) return sanitizeSettings(undefined)
  try {
    const stored = await chrome.storage.local.get(SETTINGS_STORAGE_KEY)
    return sanitizeSettings(stored[SETTINGS_STORAGE_KEY])
  } catch {
    return sanitizeSettings(undefined)
  }
}

export async function saveSettings(settings: QrSettings): Promise<void> {
  if (!hasChrome() || !chrome.storage?.local) return
  await chrome.storage.local.set({ [SETTINGS_STORAGE_KEY]: settings })
}

/**
 * The shortcut assigned to open the popup: a string like "⌥⇧Q", "" when the user
 * removed it, or null when commands aren't available.
 */
export async function getActionShortcut(): Promise<string | null> {
  if (!hasChrome() || !chrome.commands?.getAll) return null
  try {
    const commands = await chrome.commands.getAll()
    return commands.find((command) => command.name === '_execute_action')?.shortcut ?? ''
  } catch {
    return null
  }
}

export function openShortcutSettings(): void {
  if (hasChrome() && chrome.tabs?.create) void chrome.tabs.create({ url: SHORTCUTS_PAGE })
}
