import { getAlignmentPositions } from '../vendor/qrcodeInternals'
import type { EyeShape, ModuleShape, QrDesign, QrMatrix } from '../types'
import { styleById } from './settings'

/**
 * One geometry builder feeds the inline preview, the SVG export and the PNG
 * export, so all three draw exactly the same modules.
 *
 * Coordinates are in "frame" units: module units for SVG (1 unit = 1 module) or
 * pixels for PNG (1 module = an integer number of pixels, so edges stay sharp).
 */
export interface Frame {
  /** Size of one module. */
  unit: number
  /** Distance from the canvas edge to the first module (the quiet zone). */
  offset: number
  /** Canvas width and height. */
  canvas: number
}

export interface RasterLayout {
  canvasSize: number
  moduleSize: number
  offset: number
}

/**
 * Fits the symbol into `targetSize` px using an integer module size. Leftover
 * pixels go to the quiet zone, so it is never narrower than `margin` modules.
 */
export function computeRasterLayout(matrixSize: number, targetSize: number, margin: number): RasterLayout {
  const totalModules = matrixSize + margin * 2
  const moduleSize = Math.max(1, Math.floor(targetSize / totalModules))
  const canvasSize = Math.max(targetSize, moduleSize * totalModules)
  const offset = Math.floor((canvasSize - moduleSize * matrixSize) / 2)
  return { canvasSize, moduleSize, offset }
}

export const moduleFrame = (matrix: QrMatrix, margin: number): Frame => ({
  unit: 1,
  offset: margin,
  canvas: matrix.size + margin * 2,
})

export function pixelFrame(matrix: QrMatrix, size: number, margin: number): Frame {
  const layout = computeRasterLayout(matrix.size, size, margin)
  return { unit: layout.moduleSize, offset: layout.offset, canvas: layout.canvasSize }
}

export type SvgFill = { kind: 'solid'; color: string } | { kind: 'gradient'; from: string; to: string; x1: number; y1: number; x2: number; y2: number }

export interface SvgSpec {
  canvas: number
  /** Pixel-snapped edges for square styles; antialiased curves otherwise. */
  crisp: boolean
  background: string
  fill: SvgFill
  /** Data modules (nonzero fill). */
  modules: string
  /** Finder patterns (even-odd fill). */
  eyes: string
  logo: { href: string; x: number; y: number; size: number } | null
}

const num = (n: number) => (Number.isInteger(n) ? String(n) : String(Math.round(n * 1000) / 1000))

const isFinder = (row: number, col: number, n: number) => (row < 7 && (col < 7 || col >= n - 7)) || (row >= n - 7 && col < 7)

function roundedRect(x: number, y: number, size: number, r: number): string {
  if (r <= 0) return `M${num(x)} ${num(y)}h${num(size)}v${num(size)}h${num(-size)}z`
  const s = size - 2 * r
  return (
    `M${num(x + r)} ${num(y)}h${num(s)}a${num(r)} ${num(r)} 0 0 1 ${num(r)} ${num(r)}v${num(s)}` +
    `a${num(r)} ${num(r)} 0 0 1 ${num(-r)} ${num(r)}h${num(-s)}a${num(r)} ${num(r)} 0 0 1 ${num(-r)} ${num(-r)}` +
    `v${num(-s)}a${num(r)} ${num(r)} 0 0 1 ${num(r)} ${num(-r)}z`
  )
}

function modulePath(shape: ModuleShape, x: number, y: number, u: number): string {
  switch (shape) {
    case 'rounded':
      return roundedRect(x, y, u, u * 0.32)
    case 'dot': {
      const r = u * 0.46
      const cx = x + u / 2
      return `M${num(cx - r)} ${num(y + u / 2)}a${num(r)} ${num(r)} 0 1 0 ${num(2 * r)} 0a${num(r)} ${num(r)} 0 1 0 ${num(-2 * r)} 0z`
    }
    case 'inset': {
      const s = u * 0.78
      return roundedRect(x + (u - s) / 2, y + (u - s) / 2, s, u * 0.14)
    }
    case 'square':
      return `M${num(x)} ${num(y)}h${num(u)}v${num(u)}h${num(-u)}z`
  }
}

/** 7×7 finder pattern: ring plus 3×3 centre, drawn solid so scanners lock on in every style. */
function eyePath(eye: EyeShape, x: number, y: number, u: number): string {
  const rounded = eye === 'rounded'
  return (
    roundedRect(x, y, 7 * u, rounded ? 2.1 * u : 0) +
    roundedRect(x + u, y + u, 5 * u, rounded ? 1.35 * u : 0) +
    roundedRect(x + 2 * u, y + 2 * u, 3 * u, rounded ? 0.9 * u : 0)
  )
}

/** 5×5 alignment pattern centred on (x, y) of its middle module. Kept solid for the same reason. */
function alignmentPath(eye: EyeShape, x: number, y: number, u: number): string {
  const rounded = eye === 'rounded'
  return (
    roundedRect(x - 2 * u, y - 2 * u, 5 * u, rounded ? 1.5 * u : 0) +
    roundedRect(x - u, y - u, 3 * u, rounded ? 0.75 * u : 0) +
    roundedRect(x, y, u, rounded ? 0.3 * u : 0)
  )
}

/** Logo box in module coordinates, centred on the symbol. */
export function logoArea(matrixSize: number, sizePercent: number) {
  const side = (matrixSize * sizePercent) / 100
  return { start: (matrixSize - side) / 2, side }
}

export function buildSvgSpec(matrix: QrMatrix, design: QrDesign, frame: Frame = moduleFrame(matrix, design.margin)): SvgSpec {
  const { size: n, modules } = matrix
  const { unit: u, offset } = frame
  const style = styleById(design.style)
  const separateEyes = !(style.shape === 'square' && style.eye === 'square')

  // Modules whose centre falls under the logo (plus half a module of padding) are left out.
  const area = design.logo ? logoArea(n, design.logo.size) : null
  const clearFrom = area ? area.start - 0.5 : 0
  const clearTo = area ? area.start + area.side + 0.5 : 0
  const cleared = (row: number, col: number) =>
    area !== null &&
    design.logo!.clear &&
    row + 0.5 > clearFrom &&
    row + 0.5 < clearTo &&
    col + 0.5 > clearFrom &&
    col + 0.5 < clearTo

  // Styled codes draw finder and alignment patterns as solid shapes: scanners
  // rely on their 1:1:3:1:1 and 1:1:1 proportions, which dots or insets would break.
  const alignments = separateEyes ? getAlignmentPositions(matrix.version).filter(([row, col]) => !cleared(row, col)) : []
  const inAlignment = new Uint8Array(n * n)
  for (const [row, col] of alignments) {
    for (let r = row - 2; r <= row + 2; r++) for (let c = col - 2; c <= col + 2; c++) inAlignment[r * n + c] = 1
  }

  const drawn = (row: number, col: number) =>
    modules[row * n + col] === 1 &&
    !(separateEyes && (isFinder(row, col, n) || inAlignment[row * n + col])) &&
    !cleared(row, col)

  const parts: string[] = []
  for (let row = 0; row < n; row++) {
    const y = offset + row * u
    if (style.shape === 'square') {
      // Merge horizontal runs into one rectangle each.
      let col = 0
      while (col < n) {
        if (!drawn(row, col)) {
          col++
          continue
        }
        const start = col
        while (col < n && drawn(row, col)) col++
        parts.push(`M${num(offset + start * u)} ${num(y)}h${num((col - start) * u)}v${num(u)}h${num(-(col - start) * u)}z`)
      }
    } else {
      for (let col = 0; col < n; col++) {
        if (drawn(row, col)) parts.push(modulePath(style.shape, offset + col * u, y, u))
      }
    }
  }

  const eyes = separateEyes
    ? [
        [0, 0],
        [0, n - 7],
        [n - 7, 0],
      ]
        .map(([row, col]) => eyePath(style.eye, offset + col! * u, offset + row! * u, u))
        .join('') +
      alignments.map(([row, col]) => alignmentPath(style.eye, offset + col * u, offset + row * u, u)).join('')
    : ''

  const far = offset + n * u
  const fill: SvgFill = design.gradient
    ? { kind: 'gradient', from: design.foreground, to: design.gradientTo, x1: offset, y1: offset, x2: far, y2: far }
    : { kind: 'solid', color: design.foreground }

  return {
    canvas: frame.canvas,
    crisp: !separateEyes,
    background: design.background,
    fill,
    modules: parts.join(''),
    eyes,
    logo:
      area && design.logo
        ? { href: design.logo.src, x: offset + area.start * u, y: offset + area.start * u, size: area.side * u }
        : null,
  }
}

const escapeXml = (value: string) =>
  value.replace(/[&<>"']/g, (c) => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&apos;' })[c]!)

export interface SvgStringOptions {
  /** Rendered width/height in px; defaults to the canvas size. */
  size?: number
  title?: string
  /** Include the XML declaration (for standalone .svg files). */
  standalone?: boolean
  /** Leave the logo out (the PNG path draws it separately). */
  omitLogo?: boolean
  idPrefix?: string
}

export function toSvgString(spec: SvgSpec, options: SvgStringOptions = {}): string {
  const size = options.size ?? spec.canvas
  const id = `${options.idPrefix ?? 'qr'}-fill`
  const paint = spec.fill.kind === 'solid' ? spec.fill.color : `url(#${id})`
  const defs =
    spec.fill.kind === 'gradient'
      ? `<defs><linearGradient id="${id}" gradientUnits="userSpaceOnUse" x1="${num(spec.fill.x1)}" y1="${num(spec.fill.y1)}" x2="${num(spec.fill.x2)}" y2="${num(spec.fill.y2)}">` +
        `<stop offset="0" stop-color="${spec.fill.from}"/><stop offset="1" stop-color="${spec.fill.to}"/></linearGradient></defs>`
      : ''
  const logo =
    spec.logo && !options.omitLogo
      ? `<image href="${escapeXml(spec.logo.href)}" xlink:href="${escapeXml(spec.logo.href)}" x="${num(spec.logo.x)}" y="${num(spec.logo.y)}" ` +
        `width="${num(spec.logo.size)}" height="${num(spec.logo.size)}" preserveAspectRatio="xMidYMid meet"/>`
      : ''
  const svg =
    `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink" width="${size}" height="${size}" ` +
    `viewBox="0 0 ${num(spec.canvas)} ${num(spec.canvas)}" shape-rendering="${spec.crisp ? 'crispEdges' : 'geometricPrecision'}">` +
    (options.title ? `<title>${escapeXml(options.title)}</title>` : '') +
    defs +
    `<rect width="${num(spec.canvas)}" height="${num(spec.canvas)}" fill="${spec.background}"/>` +
    `<path fill="${paint}" d="${spec.modules}"/>` +
    (spec.eyes ? `<path fill="${paint}" fill-rule="evenodd" d="${spec.eyes}"/>` : '') +
    logo +
    `</svg>`
  return options.standalone ? `<?xml version="1.0" encoding="UTF-8"?>\n${svg}\n` : svg
}
