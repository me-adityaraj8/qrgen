import { Frame, ImageIcon, Palette, RotateCcw, Ruler, Shapes, ShieldCheck } from 'lucide-react'
import type { ContrastAssessment } from '../lib/color'
import { ERROR_CORRECTION_LEVELS, EXPORT_SIZES, MARGIN_MAX, MARGIN_MIN, styleById } from '../lib/settings'
import type { ErrorCorrectionLevel, QrSettings } from '../types'
import { ColorPanel } from './ColorPanel'
import { LogoPanel } from './LogoPanel'
import { SegmentedControl } from './SegmentedControl'
import { StylePicker } from './StylePicker'
import { Panel, Slider, StepCard } from './ui'

interface CustomizeCardProps {
  settings: QrSettings
  contrast: ContrastAssessment
  isDefault: boolean
  logo: string | null
  onChange: (patch: Partial<QrSettings>) => void
  onReset: () => void
  onLogoUpload: (file: File) => void
  onLogoRemove: () => void
}

const levelOptions = ERROR_CORRECTION_LEVELS.map((level) => ({
  value: level.value,
  label: level.value,
  ariaLabel: `${level.value}, ${level.name}`,
}))

export function CustomizeCard({ settings, contrast, isDefault, logo, onChange, onReset, onLogoUpload, onLogoRemove }: CustomizeCardProps) {
  const level = ERROR_CORRECTION_LEVELS.find((option) => option.value === settings.errorCorrection)
  const sizeIndex = Math.max(0, EXPORT_SIZES.indexOf(settings.size))

  return (
    <StepCard
      step={3}
      title="Customize Your QR Code"
      subtitle="Colors, styles, logo and output"
      actions={
        <button type="button" className="button button-ghost" onClick={onReset} disabled={isDefault}>
          <RotateCcw size={14} strokeWidth={1.8} />
          Reset to defaults
        </button>
      }
    >
      <div className="customize">
        <Panel icon={<Shapes size={15} strokeWidth={1.8} />} title="Style">
          <StylePicker
            value={settings.style}
            onChange={(style) => onChange({ style, ...styleById(style).palette })}
          />
        </Panel>

        <Panel icon={<Palette size={15} strokeWidth={1.8} />} title="Colors">
          <ColorPanel settings={settings} contrast={contrast} onChange={onChange} />
        </Panel>

        <Panel icon={<ImageIcon size={15} strokeWidth={1.8} />} title="Logo (optional)">
          <LogoPanel logo={logo} settings={settings} onUpload={onLogoUpload} onRemove={onLogoRemove} onChange={onChange} />
        </Panel>

        <div className="panel-pair">
          <Panel icon={<Ruler size={15} strokeWidth={1.8} />} title="Size">
            <div className="slider-head">
              <span className="field-label">Export size</span>
              <span className="value-chip">{settings.size} px</span>
            </div>
            <Slider
              label="Export size"
              min={0}
              max={EXPORT_SIZES.length - 1}
              value={sizeIndex}
              valueText={`${settings.size} × ${settings.size} px`}
              ticks={EXPORT_SIZES.map((size, index) => ({ value: index, label: String(size) }))}
              onChange={(index) => onChange({ size: EXPORT_SIZES[index]! })}
            />
          </Panel>
          <Panel icon={<Frame size={15} strokeWidth={1.8} />} title="Margin (quiet zone)">
            <div className="slider-head">
              <span className="field-label">Modules</span>
              <span className="value-chip">{settings.margin}</span>
            </div>
            <Slider
              label="Margin"
              min={MARGIN_MIN}
              max={MARGIN_MAX}
              value={settings.margin}
              valueText={`${settings.margin} modules`}
              ticks={[4, 8, 12, 16].map((value) => ({ value, label: String(value) }))}
              onChange={(margin) => onChange({ margin })}
            />
          </Panel>
        </div>

        <Panel icon={<ShieldCheck size={15} strokeWidth={1.8} />} title="Error correction">
          <SegmentedControl<ErrorCorrectionLevel>
            legend="Error correction level"
            hideLegend
            className="control-ecc"
            options={levelOptions}
            value={settings.errorCorrection}
            onChange={(errorCorrection) => onChange({ errorCorrection })}
            hint={level ? `${level.name}. ${level.description}` : undefined}
          />
        </Panel>
      </div>
    </StepCard>
  )
}
