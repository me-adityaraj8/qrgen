/** Minimum foreground/background contrast before exports are blocked. */
export const MIN_CONTRAST_RATIO = 3

/** Normalizes `#abc`, `abc`, `#AABBCC` to `#aabbcc`; returns null for anything else. */
export function normalizeHex(value: string): string | null {
  const hex = value.trim().replace(/^#/, '').toLowerCase()
  if (/^[0-9a-f]{3}$/.test(hex)) {
    return `#${hex
      .split('')
      .map((c) => c + c)
      .join('')}`
  }
  if (/^[0-9a-f]{6}$/.test(hex)) return `#${hex}`
  return null
}

export function hexToRgb(hex: string): [number, number, number] {
  const normalized = normalizeHex(hex)
  if (!normalized) throw new Error(`Invalid hex color: ${hex}`)
  const n = Number.parseInt(normalized.slice(1), 16)
  return [(n >> 16) & 0xff, (n >> 8) & 0xff, n & 0xff]
}

/** WCAG 2 relative luminance (0 = black, 1 = white). */
export function relativeLuminance(hex: string): number {
  const [r, g, b] = hexToRgb(hex).map((channel) => {
    const c = channel / 255
    return c <= 0.04045 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4
  }) as [number, number, number]
  return 0.2126 * r + 0.7152 * g + 0.0722 * b
}

/** WCAG 2 contrast ratio between two colors, from 1 to 21. */
export function contrastRatio(a: string, b: string): number {
  const la = relativeLuminance(a)
  const lb = relativeLuminance(b)
  return (Math.max(la, lb) + 0.05) / (Math.min(la, lb) + 0.05)
}

export type ContrastAssessment =
  | { level: 'ok'; ratio: number }
  | { level: 'inverted'; ratio: number; message: string }
  | { level: 'too-low'; ratio: number; message: string }

/**
 * Low contrast blocks export. Light-on-dark codes are allowed but flagged,
 * because some older scanners only read dark modules on a light background.
 */
export function assessContrast(foreground: string | readonly string[], background: string): ContrastAssessment {
  // With a gradient every stop must stand out from the background.
  const stops = typeof foreground === 'string' ? [foreground] : foreground
  const ratio = Math.min(...stops.map((stop) => contrastRatio(stop, background)))
  if (ratio < MIN_CONTRAST_RATIO) {
    return {
      level: 'too-low',
      ratio,
      message: `Contrast is ${ratio.toFixed(1)}:1. Use at least ${MIN_CONTRAST_RATIO}:1 so scanners can read the code.`,
    }
  }
  if (stops.some((stop) => relativeLuminance(stop) > relativeLuminance(background))) {
    return {
      level: 'inverted',
      ratio,
      message: 'Light-on-dark codes may not scan on some older readers.',
    }
  }
  return { level: 'ok', ratio }
}
