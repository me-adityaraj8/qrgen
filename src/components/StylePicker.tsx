import { useId, useMemo } from 'react'
import { buildQrCode } from '../lib/qr'
import { buildSvgSpec } from '../lib/render'
import { QR_STYLES } from '../lib/settings'
import type { QrStyleId } from '../types'
import { QrSvg } from './QrSvg'

// Thumbnails are real renders of a small sample code in each style.
const SAMPLE = buildQrCode('QRGen', 'L')

export function StylePicker({ value, onChange }: { value: QrStyleId; onChange: (style: QrStyleId) => void }) {
  const name = useId()
  const thumbnails = useMemo(
    () =>
      SAMPLE.ok
        ? QR_STYLES.map((style) => buildSvgSpec(SAMPLE.qr.matrix, { style: style.id, ...style.palette, margin: 1, logo: null }))
        : [],
    [],
  )
  return (
    <div className="style-grid" role="radiogroup" aria-label="Style">
      {QR_STYLES.map((style, index) => (
        <label key={style.id} className="style-tile">
          <input
            type="radio"
            className="tile-input"
            name={name}
            value={style.id}
            checked={value === style.id}
            aria-label={style.name}
            onChange={() => onChange(style.id)}
          />
          <span className="style-card" aria-hidden="true">
            {thumbnails[index] && <QrSvg spec={thumbnails[index]} className="style-thumb" />}
          </span>
          <span className="style-name" aria-hidden="true">
            {style.name}
          </span>
        </label>
      ))}
    </div>
  )
}
