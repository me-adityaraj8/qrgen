import { CircleAlert, Copy, Database, Download, FileCode2, Grid3x3, LoaderCircle, ShieldCheck } from 'lucide-react'
import { useMemo, useState, type ReactNode } from 'react'
import { useReducedMotion } from '../hooks/useReducedMotion'
import type { BusyAction } from '../hooks/useGenerator'
import { buildSvgSpec } from '../lib/render'
import { ERROR_CORRECTION_LEVELS } from '../lib/settings'
import type { EncodedContent, ExportFormat, QrCode, QrDesign } from '../types'
import { QrSvg } from './QrSvg'
import { TYPE_ICONS } from './TypePicker'

export type PreviewPhase =
  | { kind: 'loading' }
  | { kind: 'empty' }
  | { kind: 'error'; message: string }
  | { kind: 'ready'; qr: QrCode; content: EncodedContent; stale: boolean }

export type PreviewStatus = 'loading' | 'idle' | 'encoding' | 'ready' | 'stale' | 'error' | 'blocked' | 'exporting'

const STATUS_LABELS: Record<PreviewStatus, string> = {
  loading: 'Loading',
  idle: 'Waiting for content',
  encoding: 'Encoding…',
  ready: 'QR Code Ready',
  stale: 'Out of date: press Generate',
  error: "Can't generate",
  blocked: 'Low contrast',
  exporting: 'Exporting…',
}

interface PreviewPanelProps {
  phase: PreviewPhase
  design: QrDesign
  size: number
  busy: BusyAction
  canExport: boolean
  blocked: boolean
  onDownload: (format: ExportFormat) => void
  onCopyImage: () => void
  onCopyContent: () => void
}

/** Hides a Wi-Fi password in the on-screen summary. */
const maskSecrets = (text: string, type?: EncodedContent['type']) =>
  type === 'wifi' ? text.replace(/(^|;)P:((?:\\.|[^;\\])*);/, (_, start: string) => `${start}P:••••••••;`) : text

/** Version 15 is 77×77 modules; below 1024 px such codes get hard to scan from print. */
const DENSE_VERSION = 15

export function PreviewPanel({ phase, design, size, busy, canExport, blocked, onDownload, onCopyImage, onCopyContent }: PreviewPanelProps) {
  const reducedMotion = useReducedMotion()
  const qr = phase.kind === 'ready' ? phase.qr : null
  const revealKey = qr ? `${qr.text}\n${qr.matrix.errorCorrection}` : null
  const [revealedKey, setRevealedKey] = useState<string | null>(null)
  const revealing = revealKey !== null && revealKey !== revealedKey && !reducedMotion
  const spec = useMemo(() => (qr ? buildSvgSpec(qr.matrix, design) : null), [qr, design])

  let status: PreviewStatus
  if (phase.kind === 'loading') status = 'loading'
  else if (phase.kind === 'empty') status = 'idle'
  else if (phase.kind === 'error') status = 'error'
  else if (phase.stale) status = 'stale'
  else if (blocked) status = 'blocked'
  else if (busy) status = 'exporting'
  else status = revealing ? 'encoding' : 'ready'

  const level = qr ? ERROR_CORRECTION_LEVELS.find((option) => option.value === qr.matrix.errorCorrection) : undefined
  const content = phase.kind === 'ready' ? phase.content : null
  const TypeIcon = content ? TYPE_ICONS[content.type] : null
  const frameState = phase.kind === 'ready' ? (phase.stale ? 'stale' : 'ready') : phase.kind
  const dense = qr !== null && qr.matrix.version >= DENSE_VERSION && size < 1024
  // Shown on screen only; copying still copies the exact payload.
  const display = qr ? maskSecrets(qr.text, content?.type).replace(/\r?\n/g, ' ⏎ ') : undefined
  const busyIcon = (action: BusyAction, icon: ReactNode) =>
    busy === action ? <LoaderCircle className="spin" size={18} strokeWidth={2} /> : icon

  return (
    <aside className="preview" aria-label="QR code preview" data-status={status}>
      <div className="preview-card">
        <div className="preview-head">
          <span className="status">
            <span className="status-dot" aria-hidden="true" />
            {STATUS_LABELS[status]}
          </span>
          <span className={`chip${dense ? ' is-warning' : ''}`} title={dense ? 'Dense code: export at 1024 px or larger' : undefined}>
            {dense ? `Dense · use ≥1024 px` : `${size} × ${size} px`}
          </span>
        </div>

        <div className="stage">
          <span className="brackets" key={`brackets-${revealKey}`} aria-hidden="true">
            <i />
            <i />
            <i />
            <i />
          </span>
          <div className={`qr-frame is-${frameState}`}>
            {spec && qr && (
              <div
                key={revealKey}
                className={`qr-reveal${revealing ? ' is-revealing' : ''}`}
                onAnimationEnd={(event) => {
                  if (event.animationName === 'qr-reveal') setRevealedKey(revealKey)
                }}
              >
                <QrSvg spec={spec} className="qr-graphic" label={`QR code for ${content?.label ?? qr.text}`} />
                <span className="scanline" aria-hidden="true" />
              </div>
            )}
            {phase.kind === 'ready' && phase.stale && (
              <div className="stale-overlay">
                <span className="stale-chip">Press Generate to update</span>
              </div>
            )}
            {phase.kind === 'empty' && <p className="frame-message">Your QR code will appear here</p>}
            {phase.kind === 'error' && (
              <p className="frame-message is-error">
                <CircleAlert size={20} strokeWidth={1.75} />
                {phase.message}
              </p>
            )}
          </div>
        </div>
      </div>

      <div className="encoded">
        <p className="encoded-label">Encoded content</p>
        <div className="encoded-row">
          <span className="encoded-icon" aria-hidden="true">
            {TypeIcon && <TypeIcon size={15} strokeWidth={1.8} />}
          </span>
          <span className="encoded-text" title={display}>
            {display ?? 'Nothing encoded yet'}
          </span>
          <button type="button" className="icon-button" aria-label="Copy encoded content" title="Copy encoded content" disabled={!qr} onClick={onCopyContent}>
            <Copy size={15} strokeWidth={1.8} />
          </button>
        </div>
      </div>

      <dl className="stats">
        <div className="stat">
          <span className="stat-icon" aria-hidden="true">
            <Grid3x3 size={16} strokeWidth={1.8} />
          </span>
          <div>
            <dt>Version</dt>
            <dd>{qr ? qr.matrix.version : '—'}</dd>
            <dd className="stat-sub">{qr ? `${qr.matrix.size} × ${qr.matrix.size} modules` : 'Auto'}</dd>
          </div>
        </div>
        <div className="stat">
          <span className="stat-icon" aria-hidden="true">
            <ShieldCheck size={16} strokeWidth={1.8} />
          </span>
          <div>
            <dt>Error correction</dt>
            <dd>{qr ? `Level ${qr.matrix.errorCorrection}` : '—'}</dd>
            <dd className="stat-sub">{level ? `~${level.recovery} recovery` : ' '}</dd>
          </div>
        </div>
        <div className="stat">
          <span className="stat-icon" aria-hidden="true">
            <Database size={16} strokeWidth={1.8} />
          </span>
          <div>
            <dt>Data size</dt>
            <dd>{qr ? `${qr.dataBytes} bytes` : '—'}</dd>
            <dd className="stat-sub">{qr ? `${qr.matrix.totalCodewords} with ECC` : ' '}</dd>
          </div>
        </div>
      </dl>

      <div className="downloads" role="group" aria-label="Download QR code">
        <button
          type="button"
          className="download download-primary"
          disabled={!canExport}
          aria-disabled={busy !== null || undefined}
          aria-label={`Download PNG, ${size} px`}
          onClick={() => busy === null && onDownload('png')}
        >
          {busyIcon('png', <Download size={18} strokeWidth={2} />)}
          <span className="download-text">
            <span className="download-title">Download PNG</span>
            <span className="download-sub">
              {size} × {size} px
            </span>
          </span>
        </button>
        <button
          type="button"
          className="download download-secondary"
          disabled={!canExport}
          aria-disabled={busy !== null || undefined}
          aria-label="Download SVG, Vector"
          onClick={() => busy === null && onDownload('svg')}
        >
          {busyIcon('svg', <FileCode2 size={18} strokeWidth={1.8} />)}
          <span className="download-text">
            <span className="download-title">Download SVG</span>
            <span className="download-sub">Vector (scalable)</span>
          </span>
        </button>
      </div>
      <button
        type="button"
        className="button copy-image"
        disabled={!canExport}
        aria-disabled={busy !== null || undefined}
        onClick={() => busy === null && onCopyImage()}
      >
        {busy === 'copy' ? <LoaderCircle className="spin" size={15} strokeWidth={2} /> : <Copy size={15} strokeWidth={1.8} />}
        Copy to clipboard
      </button>
      {blocked && <p className="preview-note">Raise the contrast to download.</p>}
    </aside>
  )
}
