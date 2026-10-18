import { ArrowLeftRight, TriangleAlert } from 'lucide-react'
import type { ContrastAssessment } from '../lib/color'
import { COLOR_SWATCHES } from '../lib/settings'
import type { QrSettings } from '../types'
import { ColorField } from './ColorField'
import { Switch } from './ui'

interface ColorPanelProps {
  settings: QrSettings
  contrast: ContrastAssessment
  onChange: (patch: Partial<QrSettings>) => void
}

export function ColorPanel({ settings, contrast, onChange }: ColorPanelProps) {
  return (
    <div className="colors">
      <div className="color-row">
        <ColorField label={settings.gradient ? 'Gradient start' : 'Foreground'} value={settings.foreground} onChange={(foreground) => onChange({ foreground })} />
        <button
          type="button"
          className="icon-button swap-button"
          aria-label="Swap foreground and background colors"
          title="Swap colors"
          onClick={() => onChange({ foreground: settings.background, background: settings.foreground })}
        >
          <ArrowLeftRight size={15} strokeWidth={1.8} />
        </button>
        <ColorField label="Background" value={settings.background} onChange={(background) => onChange({ background })} />
      </div>

      <div className="swatch-row">
        <div className="swatches" role="group" aria-label="Foreground swatches">
          {COLOR_SWATCHES.map((swatch) => (
            <button
              key={swatch.value}
              type="button"
              className="swatch"
              style={{ background: swatch.value }}
              aria-label={`${swatch.name} foreground`}
              aria-pressed={settings.foreground === swatch.value}
              onClick={() => onChange({ foreground: swatch.value })}
            />
          ))}
          <label className="swatch swatch-custom" title="Custom foreground color">
            <input
              type="color"
              className="swatch-picker"
              value={settings.foreground}
              aria-label="Custom foreground color"
              onChange={(event) => onChange({ foreground: event.target.value })}
            />
          </label>
        </div>
        <Switch checked={settings.gradient} onChange={(gradient) => onChange({ gradient })} label="Gradient" />
      </div>

      {settings.gradient && (
        <div className="color-row is-single">
          <ColorField label="Gradient end" value={settings.gradientTo} onChange={(gradientTo) => onChange({ gradientTo })} />
        </div>
      )}

      {contrast.level !== 'ok' && (
        <p
          className={`notice ${contrast.level === 'too-low' ? 'is-error' : 'is-warning'}`}
          role={contrast.level === 'too-low' ? 'alert' : undefined}
        >
          <TriangleAlert size={13} strokeWidth={2} />
          {contrast.message}
        </p>
      )}
    </div>
  )
}
