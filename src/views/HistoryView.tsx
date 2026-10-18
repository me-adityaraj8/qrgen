import { History, KeyRound, RotateCcw, Trash2 } from 'lucide-react'
import { useMemo } from 'react'
import { TYPE_ICONS } from '../components/TypePicker'
import { QrSvg } from '../components/QrSvg'
import { relativeTime } from '../lib/history'
import { QR_TYPES } from '../lib/payload'
import { buildQrCode } from '../lib/qr'
import { buildSvgSpec } from '../lib/render'
import type { HistoryEntry } from '../types'

interface HistoryViewProps {
  entries: HistoryEntry[]
  enabled: boolean
  onEnable: () => void
  onRestore: (entry: HistoryEntry) => void
  onRemove: (id: string) => void
  onClear: () => void
}

const typeName = (type: HistoryEntry['type']) => QR_TYPES.find((item) => item.id === type)?.name ?? type

function Thumbnail({ entry }: { entry: HistoryEntry }) {
  const spec = useMemo(() => {
    const result = buildQrCode(entry.text, entry.design.errorCorrection)
    return result.ok ? buildSvgSpec(result.qr.matrix, { ...entry.design, margin: 2, logo: null }) : null
  }, [entry])
  return <span className="history-thumb">{spec && <QrSvg spec={spec} />}</span>
}

export function HistoryView({ entries, enabled, onEnable, onRestore, onRemove, onClear }: HistoryViewProps) {
  return (
    <section className="page" aria-labelledby="history-title">
      <header className="page-head">
        <div>
          <h2 id="history-title" className="page-title">
            History
          </h2>
          <p className="page-subtitle">Codes you downloaded or copied. Stored only on this device.</p>
        </div>
        <button type="button" className="button button-ghost" onClick={onClear} disabled={entries.length === 0}>
          <Trash2 size={14} strokeWidth={1.8} />
          Clear all
        </button>
      </header>

      {!enabled && (
        <p className="notice is-info page-notice">
          History is off, so new codes aren't saved.{' '}
          <button type="button" className="inline-link" onClick={onEnable}>
            Turn it on
          </button>
        </p>
      )}

      {entries.length === 0 ? (
        <div className="empty">
          <span className="empty-icon" aria-hidden="true">
            <History size={26} strokeWidth={1.5} />
          </span>
          <p className="empty-title">No saved codes yet</p>
          <p className="empty-text">Download or copy a QR code and it will show up here.</p>
        </div>
      ) : (
        <ul className="history-list">
          {entries.map((entry) => {
            const Icon = TYPE_ICONS[entry.type]
            return (
              <li key={entry.id} className="history-item">
                <Thumbnail entry={entry} />
                <div className="history-body">
                  <p className="history-label" title={entry.label}>
                    {entry.label}
                  </p>
                  <p className="history-meta">
                    <span className="type-chip">
                      <Icon size={12} strokeWidth={2} />
                      {typeName(entry.type)}
                    </span>
                    <span>{relativeTime(entry.createdAt)}</span>
                    {entry.passwordOmitted && (
                      <span className="history-flag">
                        <KeyRound size={12} strokeWidth={2} />
                        Password not saved
                      </span>
                    )}
                  </p>
                </div>
                <button type="button" className="button button-secondary" onClick={() => onRestore(entry)} aria-label={`Open ${entry.label}`}>
                  <RotateCcw size={14} strokeWidth={1.8} />
                  Open
                </button>
                <button type="button" className="icon-button" onClick={() => onRemove(entry.id)} aria-label={`Delete ${entry.label}`} title="Delete">
                  <Trash2 size={15} strokeWidth={1.8} />
                </button>
              </li>
            )
          })}
        </ul>
      )}
    </section>
  )
}
