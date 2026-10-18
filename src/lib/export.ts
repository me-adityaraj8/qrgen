import type { ExportFormat, QrCode, QrDesign } from '../types'
import { buildSvgSpec, pixelFrame, toSvgString } from './render'

export class ExportError extends Error {
  override name = 'ExportError'
}

function loadImage(src: string): Promise<HTMLImageElement> {
  return new Promise((resolve, reject) => {
    const image = new Image()
    image.onload = () => resolve(image)
    image.onerror = () => reject(new ExportError("Your browser couldn't render the QR image."))
    image.src = src
  })
}

/**
 * Draws the code in pixel space (integer module size, exact output size), then
 * the logo on top. The logo is drawn separately so it never depends on how the
 * browser loads images nested inside an SVG.
 */
async function renderPng(qr: QrCode, design: QrDesign, size: number): Promise<Blob> {
  const frame = pixelFrame(qr.matrix, size, design.margin)
  const spec = buildSvgSpec(qr.matrix, design, frame)
  const svgUrl = URL.createObjectURL(new Blob([toSvgString(spec, { omitLogo: true })], { type: 'image/svg+xml' }))
  try {
    const [code, logo] = await Promise.all([loadImage(svgUrl), spec.logo ? loadImage(spec.logo.href) : null])
    const canvas = document.createElement('canvas')
    canvas.width = frame.canvas
    canvas.height = frame.canvas
    const context = canvas.getContext('2d')
    if (!context) throw new ExportError("Your browser couldn't create the PNG image.")
    context.drawImage(code, 0, 0, frame.canvas, frame.canvas)
    if (logo && spec.logo) {
      // Contain the logo inside its square, keeping its aspect ratio.
      const scale = Math.min(spec.logo.size / logo.naturalWidth, spec.logo.size / logo.naturalHeight)
      const width = logo.naturalWidth * scale
      const height = logo.naturalHeight * scale
      context.drawImage(logo, spec.logo.x + (spec.logo.size - width) / 2, spec.logo.y + (spec.logo.size - height) / 2, width, height)
    }
    const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, 'image/png'))
    if (!blob) throw new ExportError("Your browser couldn't create the PNG image.")
    return blob
  } finally {
    URL.revokeObjectURL(svgUrl)
  }
}

/** Renders the file from the same matrix the preview shows, so it always encodes `qr.text`. */
export async function renderExport(qr: QrCode, design: QrDesign, size: number, format: ExportFormat): Promise<Blob> {
  if (format === 'png') return renderPng(qr, design, size)
  const svg = toSvgString(buildSvgSpec(qr.matrix, design), { size, title: `QR code: ${qr.text}`, standalone: true })
  return new Blob([svg], { type: 'image/svg+xml' })
}

/** Copies the PNG to the clipboard. The promise form keeps the click's user activation. */
export async function copyImage(qr: QrCode, design: QrDesign, size: number): Promise<void> {
  if (typeof ClipboardItem === 'undefined' || !navigator.clipboard?.write) {
    throw new ExportError("This browser can't copy images to the clipboard.")
  }
  try {
    await navigator.clipboard.write([new ClipboardItem({ 'image/png': renderPng(qr, design, size) })])
  } catch (error) {
    if (error instanceof ExportError) throw error
    throw new ExportError("Couldn't copy the image. Try downloading it instead.")
  }
}
