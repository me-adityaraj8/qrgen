export class DownloadError extends Error {
  override name = 'DownloadError'
  constructor(
    message: string,
    readonly canceled = false,
  ) {
    super(message)
  }
}

/** How long to wait for a download to finish before treating it as started. */
const SETTLE_TIMEOUT_MS = 15_000

const INTERRUPT_MESSAGES: Record<string, string> = {
  USER_CANCELED: 'Download canceled.',
  FILE_NO_SPACE: 'Download failed: not enough disk space.',
  FILE_ACCESS_DENIED: "Download failed: Chrome couldn't write to your downloads folder.",
  FILE_NAME_TOO_LONG: 'Download failed: the file name is too long.',
  FILE_TOO_LARGE: 'Download failed: the file is too large.',
  FILE_BLOCKED: 'Download failed: blocked by your browser or system settings.',
  FILE_SECURITY_CHECK_FAILED: 'Download failed: blocked by a security check.',
}

const interruptMessage = (reason?: string) =>
  (reason && INTERRUPT_MESSAGES[reason]) || `Download failed${reason ? ` (${reason.toLowerCase().replaceAll('_', ' ')})` : ''}.`

/** Resolves with "complete" or "pending" (still running), rejects if Chrome interrupts it. */
function waitForDownload(id: number): Promise<'complete' | 'pending'> {
  return new Promise((resolve, reject) => {
    let settled = false
    const finish = (outcome: 'complete' | 'pending' | DownloadError) => {
      if (settled) return
      settled = true
      chrome.downloads.onChanged.removeListener(onChanged)
      clearTimeout(timer)
      if (outcome instanceof DownloadError) reject(outcome)
      else resolve(outcome)
    }
    const onChanged = (delta: chrome.downloads.DownloadDelta) => {
      if (delta.id !== id || !delta.state) return
      if (delta.state.current === 'complete') finish('complete')
      if (delta.state.current === 'interrupted') {
        const reason = delta.error?.current
        finish(new DownloadError(interruptMessage(reason), reason === 'USER_CANCELED'))
      }
    }
    chrome.downloads.onChanged.addListener(onChanged)
    // A "Save as" dialog can keep the download pending; don't block the UI on it.
    const timer = setTimeout(() => finish('pending'), SETTLE_TIMEOUT_MS)
    // The download may already be finished before the listener was attached.
    chrome.downloads
      .search({ id })
      .then(([item]) => {
        if (item?.state === 'complete') finish('complete')
        if (item?.state === 'interrupted') {
          finish(new DownloadError(interruptMessage(item.error), item.error === 'USER_CANCELED'))
        }
      })
      .catch(() => {
        // onChanged still reports the outcome.
      })
  })
}

function anchorDownload(url: string, filename: string): void {
  const link = document.createElement('a')
  link.href = url
  link.download = filename
  link.rel = 'noopener'
  document.body.append(link)
  link.click()
  link.remove()
}

export interface SaveResult {
  /** Name the file was saved under (Chrome may add " (1)"), when known. */
  filename?: string
  /** False when the download is still pending, e.g. behind a "Save as" dialog. */
  complete: boolean
}

async function savedFilename(id: number): Promise<string | undefined> {
  try {
    const [item] = await chrome.downloads.search({ id })
    return item?.filename ? item.filename.split(/[\\/]/).pop() : undefined
  } catch {
    return undefined
  }
}

/**
 * Saves a blob through `chrome.downloads` (reports failures, respects the user's
 * "ask where to save" preference) or, outside an extension, through an <a download>.
 */
export async function saveBlob(blob: Blob, filename: string): Promise<SaveResult> {
  const url = URL.createObjectURL(blob)
  try {
    if (typeof chrome !== 'undefined' && chrome.downloads?.download) {
      let id: number | undefined
      try {
        id = await chrome.downloads.download({ url, filename, conflictAction: 'uniquify' })
      } catch (error) {
        throw new DownloadError(
          `Download failed: ${error instanceof Error ? error.message : 'Chrome rejected the request'}.`,
        )
      }
      if (typeof id !== 'number') throw new DownloadError('Download failed: Chrome rejected the request.')
      const outcome = await waitForDownload(id)
      if (outcome === 'pending') return { complete: false }
      return { complete: true, filename: (await savedFilename(id)) ?? filename }
    }
    anchorDownload(url, filename)
    return { complete: true, filename }
  } finally {
    // Give the browser time to read the blob before releasing it.
    setTimeout(() => URL.revokeObjectURL(url), 30_000)
  }
}
