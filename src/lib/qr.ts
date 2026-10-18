import QRCode from 'qrcode'
import { getSymbolTotalCodewords } from '../vendor/qrcodeInternals'
import type { ErrorCorrectionLevel, QrBuildResult } from '../types'

/** Minimum light border around the symbol, in modules (ISO/IEC 18004). */
export const QUIET_ZONE_MODULES = 4

const utf8Length = (value: string) => new TextEncoder().encode(value).length

/** Version 40 byte-mode capacity per level, in bytes (URLs are ASCII, so bytes == characters). */
export const MAX_URL_LENGTH: Record<ErrorCorrectionLevel, number> = {
  L: 2953,
  M: 2331,
  Q: 1663,
  H: 1273,
}

const formatCount = (n: number) => n.toLocaleString('en-US')

/**
 * Encodes `text` with the `qrcode` library. Version (size) and mask pattern are
 * chosen automatically: the smallest version that fits, and the mask with the
 * lowest penalty score.
 */
export function buildQrCode(text: string, errorCorrection: ErrorCorrectionLevel): QrBuildResult {
  try {
    const symbol = QRCode.create(text, { errorCorrectionLevel: errorCorrection })
    const { size, data } = symbol.modules
    const modules = new Uint8Array(size * size)
    for (let i = 0; i < modules.length; i++) modules[i] = data[i] ? 1 : 0
    return {
      ok: true,
      qr: {
        text,
        dataBytes: utf8Length(text),
        matrix: {
          size,
          modules,
          version: symbol.version,
          errorCorrection,
          maskPattern: symbol.maskPattern ?? 0,
          totalCodewords: getSymbolTotalCodewords(symbol.version),
        },
      },
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error)
    const bytes = utf8Length(text)
    if (/too big|amount of data/i.test(message) || bytes > MAX_URL_LENGTH[errorCorrection]) {
      return {
        ok: false,
        code: 'too-long',
        error:
          `${formatCount(bytes)} bytes is too long for a QR code at level ${errorCorrection} ` +
          `(about ${formatCount(MAX_URL_LENGTH[errorCorrection])} max). ` +
          'Choose a lower error-correction level or shorten the content.',
      }
    }
    return { ok: false, code: 'unknown', error: "Couldn't generate a QR code for this content." }
  }
}
