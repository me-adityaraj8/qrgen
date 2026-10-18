import type { ErrorCorrectionLevel, EyeShape, ExportSize, ModuleShape, QrSettings, QrStyleId } from '../types'
import { normalizeHex } from './color'

export const MARGIN_MIN = 4
export const MARGIN_MAX = 16
export const LOGO_SIZE_MIN = 10
export const LOGO_SIZE_MAX = 25

export const DEFAULT_SETTINGS: Readonly<QrSettings> = Object.freeze({
  style: 'classic',
  foreground: '#000000',
  background: '#ffffff',
  gradient: false,
  gradientTo: '#2563eb',
  errorCorrection: 'M',
  size: 1024,
  margin: 4,
  logoSize: 20,
  logoClear: true,
})

export const EXPORT_SIZES: readonly ExportSize[] = [256, 512, 1024, 2048]

export interface QrStyle {
  id: QrStyleId
  name: string
  shape: ModuleShape
  eye: EyeShape
  /** Colors applied when the style is picked. All keep at least 4.5:1 contrast on white. */
  palette: Pick<QrSettings, 'foreground' | 'background' | 'gradient' | 'gradientTo'>
}

export const QR_STYLES: readonly QrStyle[] = [
  { id: 'classic', name: 'Classic', shape: 'square', eye: 'square', palette: { foreground: '#000000', background: '#ffffff', gradient: false, gradientTo: '#2563eb' } },
  { id: 'rounded', name: 'Rounded', shape: 'rounded', eye: 'rounded', palette: { foreground: '#111827', background: '#ffffff', gradient: false, gradientTo: '#2563eb' } },
  { id: 'dots', name: 'Dots', shape: 'dot', eye: 'rounded', palette: { foreground: '#111827', background: '#ffffff', gradient: false, gradientTo: '#2563eb' } },
  { id: 'galaxy', name: 'Galaxy', shape: 'rounded', eye: 'rounded', palette: { foreground: '#6d28d9', background: '#ffffff', gradient: true, gradientTo: '#2563eb' } },
  { id: 'neon', name: 'Neon', shape: 'dot', eye: 'rounded', palette: { foreground: '#047857', background: '#ffffff', gradient: true, gradientTo: '#0369a1' } },
  { id: 'minimal', name: 'Minimal', shape: 'inset', eye: 'rounded', palette: { foreground: '#1f2937', background: '#ffffff', gradient: false, gradientTo: '#2563eb' } },
]

export const styleById = (id: QrStyleId): QrStyle => QR_STYLES.find((style) => style.id === id) ?? QR_STYLES[0]!

/** Foreground swatches; each keeps at least 4.5:1 contrast on white. */
export const COLOR_SWATCHES: readonly { name: string; value: string }[] = [
  { name: 'Black', value: '#000000' },
  { name: 'Blue', value: '#1d4ed8' },
  { name: 'Violet', value: '#6d28d9' },
  { name: 'Pink', value: '#be185d' },
  { name: 'Red', value: '#b91c1c' },
  { name: 'Orange', value: '#c2410c' },
  { name: 'Green', value: '#047857' },
]

export const ERROR_CORRECTION_LEVELS: readonly {
  value: ErrorCorrectionLevel
  name: string
  /** Approximate share of damaged codewords the level can restore. */
  recovery: string
  description: string
}[] = [
  { value: 'L', name: 'Low', recovery: '7%', description: 'Restores ~7% of damage. Smallest code.' },
  { value: 'M', name: 'Medium', recovery: '15%', description: 'Restores ~15% of damage. Good default for most uses.' },
  { value: 'Q', name: 'Quartile', recovery: '25%', description: 'Restores ~25% of damage. Sturdier for print.' },
  { value: 'H', name: 'High', recovery: '30%', description: 'Restores ~30% of damage. Best with a logo.' },
]

const isLevel = (value: unknown): value is ErrorCorrectionLevel =>
  value === 'L' || value === 'M' || value === 'Q' || value === 'H'

const isSize = (value: unknown): value is ExportSize => EXPORT_SIZES.includes(value as ExportSize)

const isStyle = (value: unknown): value is QrStyleId => QR_STYLES.some((style) => style.id === value)

const clampInt = (value: unknown, min: number, max: number, fallback: number) =>
  typeof value === 'number' && Number.isFinite(value) ? Math.min(max, Math.max(min, Math.round(value))) : fallback

const hexOr = (value: unknown, fallback: string) => (typeof value === 'string' && normalizeHex(value)) || fallback

/** Accepts anything read from storage and returns valid settings, falling back per field. */
export function sanitizeSettings(value: unknown): QrSettings {
  const input = (value && typeof value === 'object' ? value : {}) as Record<string, unknown>
  const d = DEFAULT_SETTINGS
  return {
    style: isStyle(input.style) ? input.style : d.style,
    foreground: hexOr(input.foreground, d.foreground),
    background: hexOr(input.background, d.background),
    gradient: typeof input.gradient === 'boolean' ? input.gradient : d.gradient,
    gradientTo: hexOr(input.gradientTo, d.gradientTo),
    errorCorrection: isLevel(input.errorCorrection) ? input.errorCorrection : d.errorCorrection,
    size: isSize(input.size) ? input.size : d.size,
    margin: clampInt(input.margin, MARGIN_MIN, MARGIN_MAX, d.margin),
    logoSize: clampInt(input.logoSize, LOGO_SIZE_MIN, LOGO_SIZE_MAX, d.logoSize),
    logoClear: typeof input.logoClear === 'boolean' ? input.logoClear : d.logoClear,
  }
}

export const isDefaultSettings = (settings: QrSettings) =>
  (Object.keys(DEFAULT_SETTINGS) as (keyof QrSettings)[]).every((key) => settings[key] === DEFAULT_SETTINGS[key])
