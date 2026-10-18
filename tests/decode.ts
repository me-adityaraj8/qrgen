/**
 * Independent QR decoders used to verify generated images: jsQR (pure JS) and
 * ZXing C++ (compiled to WebAssembly). Neither shares code with the `qrcode`
 * encoder the extension uses.
 */
import { Resvg } from '@resvg/resvg-js'
import jsQR from 'jsqr'
import { PNG } from 'pngjs'
import { readBarcodes } from 'zxing-wasm/reader'

export interface Pixels {
  width: number
  height: number
  data: Uint8ClampedArray
}

export function pngToPixels(png: Buffer | Uint8Array): Pixels {
  const image = PNG.sync.read(Buffer.from(png))
  return { width: image.width, height: image.height, data: new Uint8ClampedArray(image.data) }
}

export function pixelsToPng({ width, height, data }: Pixels): Buffer {
  const png = new PNG({ width, height })
  png.data = Buffer.from(data.buffer, data.byteOffset, data.byteLength)
  return PNG.sync.write(png)
}

/** Rasterizes SVG markup with resvg (a renderer independent of Chrome). */
export function svgToPng(svg: string, width = 600): Buffer {
  return Buffer.from(new Resvg(svg, { fitTo: { mode: 'width', value: width }, font: { loadSystemFonts: false } }).render().asPng())
}

export function decodeWithJsQr({ width, height, data }: Pixels): string | null {
  return jsQR(data, width, height, { inversionAttempts: 'attemptBoth' })?.data ?? null
}

export async function decodeWithZxing(png: Buffer | Uint8Array): Promise<string | null> {
  const [result] = await readBarcodes(new Uint8Array(png), { formats: ['QRCode'], tryInvert: true })
  return result?.isValid ? result.text : null
}

/** Decodes a PNG with both decoders; both must agree for a result to count. */
export async function decodePng(png: Buffer | Uint8Array): Promise<{ jsqr: string | null; zxing: string | null }> {
  return { jsqr: decodeWithJsQr(pngToPixels(png)), zxing: await decodeWithZxing(png) }
}

export async function decodeSvg(svg: string, width = 600) {
  return decodePng(svgToPng(svg, width))
}
