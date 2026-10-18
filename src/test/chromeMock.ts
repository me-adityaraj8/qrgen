import { vi } from 'vitest'

type DownloadListener = (delta: chrome.downloads.DownloadDelta) => void

export interface ChromeMockOptions {
  /** URL of the active tab; undefined simulates a tab without a readable URL. */
  tabUrl?: string
  stored?: Record<string, unknown>
  shortcut?: string
}

/** Minimal in-memory implementation of the extension APIs the popup uses. */
export function installChromeMock({ tabUrl, stored = {}, shortcut = '⌥⇧Q' }: ChromeMockOptions = {}) {
  const storage: Record<string, unknown> = structuredClone(stored)
  const listeners = new Set<DownloadListener>()
  const items = new Map<number, chrome.downloads.DownloadItem>()
  let nextId = 1

  const downloads = {
    download: vi.fn(async (options: chrome.downloads.DownloadOptions) => {
      const id = nextId++
      items.set(id, { id, state: 'complete', filename: `/Users/test/Downloads/${options.filename}` } as chrome.downloads.DownloadItem)
      return id
    }),
    search: vi.fn(async ({ id }: chrome.downloads.DownloadQuery) => (id && items.has(id) ? [items.get(id)!] : [])),
    onChanged: {
      addListener: (listener: DownloadListener) => listeners.add(listener),
      removeListener: (listener: DownloadListener) => listeners.delete(listener),
    },
  }

  const mock = {
    runtime: { id: 'test-extension', getManifest: () => ({ version: '1.0.0' }) },
    tabs: {
      query: vi.fn(async () => [{ id: 1, url: tabUrl }]),
      create: vi.fn(async () => ({})),
    },
    storage: {
      local: {
        get: vi.fn(async (key: string) => ({ [key]: storage[key] })),
        set: vi.fn(async (values: Record<string, unknown>) => {
          Object.assign(storage, structuredClone(values))
        }),
        remove: vi.fn(async (key: string) => {
          delete storage[key]
        }),
      },
    },
    commands: { getAll: vi.fn(async () => [{ name: '_execute_action', shortcut }]) },
    downloads,
  }

  ;(globalThis as unknown as { chrome: unknown }).chrome = mock

  return {
    chrome: mock,
    storage,
    /** Makes the next download stay in progress, then get interrupted with `reason`. */
    interruptNextDownload(reason: string) {
      downloads.download.mockImplementationOnce(async () => {
        const id = nextId++
        items.set(id, { id, state: 'in_progress' } as chrome.downloads.DownloadItem)
        setTimeout(() => {
          for (const listener of listeners) {
            listener({ id, state: { current: 'interrupted', previous: 'in_progress' }, error: { current: reason } })
          }
        }, 10)
        return id
      })
    },
  }
}

export function uninstallChromeMock() {
  delete (globalThis as unknown as { chrome?: unknown }).chrome
}
