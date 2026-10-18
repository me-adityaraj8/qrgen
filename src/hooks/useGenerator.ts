import { useMemo, useState } from 'react'
import { copyText } from '../lib/clipboard'
import { assessContrast } from '../lib/color'
import { DownloadError, saveBlob } from '../lib/download'
import { copyImage, ExportError, renderExport } from '../lib/export'
import { filenameFor } from '../lib/filename'
import { createEntry } from '../lib/history'
import { EMPTY_FORMS, encodeContent, utf8Length } from '../lib/payload'
import { buildQrCode, MAX_URL_LENGTH } from '../lib/qr'
import { normalizeUrl } from '../lib/url'
import type {
  ActiveTabState,
  EncodedContent,
  ExportFormat,
  HistoryEntry,
  QrBuildResult,
  QrDesign,
  QrForms,
  QrSettings,
  QrType,
} from '../types'

export type Notify = (tone: 'success' | 'error' | 'neutral', text: string) => void
export type FieldError = { field?: string; message: string } | null
export type BusyAction = ExportFormat | 'copy' | null

/** Show the byte counter once content uses this share of the level's capacity. */
const CAPACITY_WARNING_SHARE = 0.6

interface Committed {
  content: EncodedContent
  form: QrForms[QrType]
}

interface Options {
  tab: ActiveTabState
  settings: QrSettings
  settingsReady: boolean
  updateSettings: (patch: Partial<QrSettings>) => void
  logoSrc: string | null
  /** Called after a successful download or copy, with the history record to keep. */
  onRecord: (entry: HistoryEntry) => void
  notify: Notify
}

/**
 * Generator state: the form being edited (draft) and the payload currently
 * encoded (committed). Generate commits the draft; a download of an edited
 * draft commits it first, so the preview and the file always match.
 */
export function useGenerator({ tab, settings, settingsReady, updateSettings, logoSrc, onRecord, notify }: Options) {
  const [type, setType] = useState<QrType>('url')
  const [forms, setForms] = useState<QrForms>(EMPTY_FORMS)
  const [committed, setCommitted] = useState<Committed | null>(null)
  const [fieldError, setFieldError] = useState<FieldError>(null)
  const [notice, setNotice] = useState<string | null>(null)
  const [busy, setBusy] = useState<BusyAction>(null)
  const [announcement, setAnnouncement] = useState('')
  const [initialized, setInitialized] = useState(false)

  // Prefill and generate from the current tab as soon as it is known.
  if (!initialized && tab.status !== 'loading') {
    setInitialized(true)
    if (tab.status === 'ready') {
      const next = { ...EMPTY_FORMS, url: { url: tab.url } }
      setForms(next)
      const result = encodeContent('url', next)
      if (result.ok) setCommitted({ content: result.content, form: next.url })
      else setFieldError({ field: result.field, message: result.error })
    } else if (tab.status === 'unsupported') {
      setNotice(`${tab.reason} Enter a web address instead.`)
    } else {
      // Chrome hides the URL of browser pages (new tab, settings, Web Store) from extensions.
      setNotice("This tab's address isn't available to extensions. Enter a URL instead.")
    }
  }

  const draft = useMemo(() => encodeContent(type, forms), [type, forms])
  const result = useMemo(
    () => (committed ? buildQrCode(committed.content.text, settings.errorCorrection) : null),
    [committed, settings.errorCorrection],
  )
  const design = useMemo<QrDesign>(
    () => ({
      style: settings.style,
      foreground: settings.foreground,
      background: settings.background,
      gradient: settings.gradient,
      gradientTo: settings.gradientTo,
      margin: settings.margin,
      logo: logoSrc ? { src: logoSrc, size: settings.logoSize, clear: settings.logoClear } : null,
    }),
    [settings, logoSrc],
  )
  const contrast = useMemo(
    () => assessContrast(settings.gradient ? [settings.foreground, settings.gradientTo] : settings.foreground, settings.background),
    [settings.gradient, settings.foreground, settings.gradientTo, settings.background],
  )

  const tabUrl = tab.status === 'ready' ? normalizeUrl(tab.url) : null
  const isCurrentTab = type === 'url' && Boolean(tabUrl?.ok && draft.ok && draft.content.text === tabUrl.url)
  const isStale = committed !== null && !(draft.ok && draft.content.text === committed.content.text)
  const hasDraftInput = Object.values(forms[type]).some((value) => typeof value === 'string' && value.trim() !== '')
  const contrastBlocks = contrast.level === 'too-low'
  const hasSomethingToExport = result === null || isStale ? hasDraftInput : result.ok
  const canExport = settingsReady && !contrastBlocks && hasSomethingToExport

  const usedBytes = draft.ok ? utf8Length(draft.content.text) : 0
  const maxBytes = MAX_URL_LENGTH[settings.errorCorrection]
  const capacity = usedBytes >= maxBytes * CAPACITY_WARNING_SHARE ? { used: usedBytes, max: maxBytes } : undefined

  const updateForm = <T extends QrType>(target: T, patch: Partial<QrForms[T]>) => {
    setForms((current) => ({ ...current, [target]: { ...current[target], ...patch } }))
    setFieldError(null)
  }

  const selectType = (next: QrType) => {
    setType(next)
    setFieldError(null)
  }

  /** Validates `formsToUse[typeToUse]` and makes it the encoded content. */
  const commit = (typeToUse = type, formsToUse = forms): { content: EncodedContent; form: QrForms[QrType]; built: QrBuildResult } | null => {
    const validation = encodeContent(typeToUse, formsToUse)
    if (!validation.ok) {
      setFieldError({ field: validation.field, message: validation.error })
      return null
    }
    const form = formsToUse[typeToUse]
    const built = buildQrCode(validation.content.text, settings.errorCorrection)
    setFieldError(null)
    setNotice(null)
    setCommitted({ content: validation.content, form })
    setAnnouncement(built.ok ? `QR code generated for ${validation.content.label}` : built.error)
    return { content: validation.content, form, built }
  }

  /** The code to export: the committed one, or the latest draft if it was edited. */
  const exportTarget = () => {
    if (result === null || isStale || !committed) return commit()
    return { content: committed.content, form: committed.form, built: result }
  }

  const record = (content: EncodedContent, form: QrForms[QrType]) => onRecord(createEntry(content, form, settings))

  const download = async (format: ExportFormat) => {
    if (busy || contrastBlocks) return
    const target = exportTarget()
    if (!target?.built.ok) return
    const filename = filenameFor(target.content, format)
    setBusy(format)
    try {
      const blob = await renderExport(target.built.qr, design, settings.size, format)
      const saved = await saveBlob(blob, filename)
      notify('success', saved.complete ? `Saved ${saved.filename ?? filename}` : `Download started: ${filename}`)
      record(target.content, target.form)
    } catch (error) {
      if (error instanceof DownloadError && error.canceled) notify('neutral', error.message)
      else
        notify(
          'error',
          error instanceof DownloadError || error instanceof ExportError ? error.message : 'Download failed. Please try again.',
        )
    } finally {
      setBusy(null)
    }
  }

  const copyCodeImage = async () => {
    if (busy || contrastBlocks) return
    const target = exportTarget()
    if (!target?.built.ok) return
    setBusy('copy')
    try {
      await copyImage(target.built.qr, design, Math.min(settings.size, 1024))
      notify('success', 'QR image copied to the clipboard')
      record(target.content, target.form)
    } catch (error) {
      notify('error', error instanceof ExportError ? error.message : "Couldn't copy the image.")
    } finally {
      setBusy(null)
    }
  }

  const copyContent = async () => {
    if (!committed) return
    if (await copyText(committed.content.text)) notify('success', 'Encoded content copied')
    else notify('error', "Couldn't copy to the clipboard.")
  }

  const fillCurrentTab = () => {
    if (tab.status !== 'ready') return
    const next = { ...forms, url: { url: tab.url } }
    setType('url')
    setForms(next)
    commit('url', next)
  }

  /** Loads a history entry back into the generator. */
  const restore = (entry: HistoryEntry) => {
    const next = { ...forms, [entry.type]: { ...EMPTY_FORMS[entry.type], ...entry.form } } as QrForms
    setType(entry.type)
    setForms(next)
    updateSettings(entry.design)
    const validation = encodeContent(entry.type, next)
    if (validation.ok) {
      setCommitted({ content: validation.content, form: next[entry.type] })
      setFieldError(null)
    } else {
      setFieldError({
        field: validation.field,
        message: entry.passwordOmitted
          ? 'Re-enter the Wi-Fi password. Passwords are never saved in history.'
          : validation.error,
      })
    }
  }

  return {
    initialized,
    type,
    forms,
    draft,
    committed: committed?.content ?? null,
    result,
    design,
    contrast,
    fieldError,
    notice,
    busy,
    announcement,
    isCurrentTab,
    isStale,
    canExport,
    contrastBlocks,
    capacity,
    selectType,
    updateForm,
    generate: () => void commit(),
    download,
    copyCodeImage,
    copyContent,
    fillCurrentTab: tab.status === 'ready' ? fillCurrentTab : undefined,
    restore,
  }
}

export type Generator = ReturnType<typeof useGenerator>
