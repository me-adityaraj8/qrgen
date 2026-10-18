import { ImagePlus, Plus, Trash2, TriangleAlert } from 'lucide-react'
import { useRef } from 'react'
import { LOGO_SIZE_MAX, LOGO_SIZE_MIN } from '../lib/settings'
import { LOGO_TYPES } from '../lib/logo'
import type { QrSettings } from '../types'
import { Slider, Switch } from './ui'

interface LogoPanelProps {
  logo: string | null
  settings: QrSettings
  onUpload: (file: File) => void
  onRemove: () => void
  onChange: (patch: Partial<QrSettings>) => void
}

export function LogoPanel({ logo, settings, onUpload, onRemove, onChange }: LogoPanelProps) {
  const input = useRef<HTMLInputElement>(null)
  const weakCorrection = logo !== null && (settings.errorCorrection === 'L' || settings.errorCorrection === 'M')

  return (
    <div className="logo-panel">
      <div className="logo-row">
        <button
          type="button"
          className={`logo-drop${logo ? ' has-logo' : ''}`}
          onClick={() => input.current?.click()}
          aria-label={logo ? 'Replace logo' : 'Add a logo'}
        >
          {logo ? <img src={logo} alt="" /> : <Plus size={20} strokeWidth={1.6} />}
        </button>
        <input
          ref={input}
          type="file"
          className="sr-only"
          tabIndex={-1}
          accept={LOGO_TYPES.join(',')}
          aria-label="Logo file"
          onChange={(event) => {
            const file = event.target.files?.[0]
            if (file) onUpload(file)
            event.target.value = ''
          }}
        />
        <div className="logo-meta">
          <p className="logo-title">{logo ? 'Logo added' : 'Add a logo to the center'}</p>
          <p className="logo-hint">PNG, JPG, WebP or SVG (max 1 MB)</p>
          {logo && (
            <div className="logo-actions">
              <button type="button" className="text-button" onClick={() => input.current?.click()}>
                <ImagePlus size={13} strokeWidth={1.8} />
                Replace
              </button>
              <button type="button" className="text-button is-danger" onClick={onRemove}>
                <Trash2 size={13} strokeWidth={1.8} />
                Remove
              </button>
            </div>
          )}
        </div>
      </div>

      <div className={`logo-options${logo ? '' : ' is-disabled'}`}>
        <div className="slider-head">
          <span className="field-label">Logo size</span>
          <span className="value-chip">{settings.logoSize}%</span>
        </div>
        <Slider
          label="Logo size"
          min={LOGO_SIZE_MIN}
          max={LOGO_SIZE_MAX}
          value={settings.logoSize}
          valueText={`${settings.logoSize}% of the code width`}
          onChange={(logoSize) => onChange({ logoSize })}
        />
        <Switch
          checked={settings.logoClear}
          disabled={!logo}
          onChange={(logoClear) => onChange({ logoClear })}
          label="Clear modules behind logo"
        />
      </div>

      {weakCorrection && (
        <p className="notice is-warning">
          <TriangleAlert size={13} strokeWidth={2} />
          <span>
            Logos hide part of the code. Use error correction Q or H.{' '}
            <button type="button" className="inline-link" onClick={() => onChange({ errorCorrection: 'H' })}>
              Use H
            </button>
          </span>
        </p>
      )}
    </div>
  )
}
