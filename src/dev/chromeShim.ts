/**
 * Development-only stand-in for the extension APIs the popup uses, so the UI
 * can be built in a regular tab with hot reload (`npm run dev`).
 *
 * - Simulated tab URL: `?tab=<url>` (default: a sample page). `?tab=` simulates
 *   a tab with no readable URL; `?tab=chrome://extensions` an unsupported one.
 * - Settings persist to localStorage.
 * - Downloads fall back to <a download> because `chrome.downloads` is omitted.
 */
export function installDevChromeShim(): void {
  const params = new URLSearchParams(location.search)
  const tabUrl = params.has('tab') ? params.get('tab') || undefined : 'https://example.com/docs/getting-started?ref=dev'
  const storageKey = 'dev-chrome-storage'

  const readStore = (): Record<string, unknown> => {
    try {
      return JSON.parse(localStorage.getItem(storageKey) ?? '{}') as Record<string, unknown>
    } catch {
      return {}
    }
  }

  const shim = {
    runtime: { id: 'dev-shim', getManifest: () => ({ version: 'dev' }) },
    tabs: {
      query: async () => [{ url: tabUrl }],
      create: async ({ url }: { url: string }) => {
        console.info('[dev] chrome.tabs.create', url)
      },
    },
    storage: {
      local: {
        get: async (key: string) => ({ [key]: readStore()[key] }),
        set: async (items: Record<string, unknown>) => {
          localStorage.setItem(storageKey, JSON.stringify({ ...readStore(), ...items }))
        },
        remove: async (key: string) => {
          const store = readStore()
          delete store[key]
          localStorage.setItem(storageKey, JSON.stringify(store))
        },
      },
    },
    commands: {
      getAll: async () => [{ name: '_execute_action', shortcut: '⌥⇧Q' }],
    },
  }

  ;(globalThis as unknown as { chrome: unknown }).chrome = shim
  document.documentElement.classList.add('dev-frame')
}
