// @vitest-environment node
import { PNG } from 'pngjs'
import { describe, expect, it } from 'vitest'
import { EMPTY_FORMS, encodeContent } from '../../src/lib/payload'
import { buildQrCode, MAX_URL_LENGTH, QUIET_ZONE_MODULES } from '../../src/lib/qr'
import { buildSvgSpec, computeRasterLayout, pixelFrame, toSvgString } from '../../src/lib/render'
import { QR_STYLES } from '../../src/lib/settings'
import { normalizeUrl } from '../../src/lib/url'
import type { ErrorCorrectionLevel, QrCode, QrDesign, QrForms, QrType } from '../../src/types'
import { decodePng, decodeSvg, pngToPixels, svgToPng } from '../decode'

const LEVELS: ErrorCorrectionLevel[] = ['L', 'M', 'Q', 'H']

const DESIGN: QrDesign = {
  style: 'classic',
  foreground: '#000000',
  background: '#ffffff',
  gradient: false,
  gradientTo: '#2563eb',
  margin: 4,
  logo: null,
}

const url = (raw: string) => {
  const result = normalizeUrl(raw)
  if (!result.ok) throw new Error(`fixture is not a valid URL: ${raw}`)
  return result.url
}

const build = (text: string, level: ErrorCorrectionLevel = 'M'): QrCode => {
  const result = buildQrCode(text, level)
  if (!result.ok) throw new Error(result.error)
  return result.qr
}

const longUrl = (length: number) => {
  const base = 'https://example.com/search?q='
  return base + 'a1b2c3d4e5'.repeat(Math.ceil(length / 10)).slice(0, length - base.length)
}

/** A 64×64 two-tone PNG logo as a data URL. */
function logoDataUrl(): string {
  const png = new PNG({ width: 64, height: 64 })
  for (let y = 0; y < 64; y++) {
    for (let x = 0; x < 64; x++) {
      const i = (y * 64 + x) * 4
      const inner = x > 16 && x < 48 && y > 16 && y < 48
      png.data[i] = inner ? 255 : 109
      png.data[i + 1] = inner ? 255 : 40
      png.data[i + 2] = inner ? 255 : 217
      png.data[i + 3] = 255
    }
  }
  return `data:image/png;base64,${PNG.sync.write(png).toString('base64')}`
}

const svgFor = (qr: QrCode, design: QrDesign, size = 600) =>
  toSvgString(buildSvgSpec(qr.matrix, design), { size, standalone: true })

/** PNG pipeline geometry (pixel frame), rasterized by resvg instead of a browser canvas. */
const pngFor = (qr: QrCode, design: QrDesign, size: number) => {
  const frame = pixelFrame(qr.matrix, size, design.margin)
  return svgToPng(toSvgString(buildSvgSpec(qr.matrix, design, frame)), frame.canvas)
}

const FIXTURES = [
  url('https://example.com'),
  url('http://localhost:3000/dashboard'),
  url('https://shop.example.co.uk/products/item?id=42&color=blue&size=M&utm_source=newsletter#reviews'),
  url('https://example.com/über/straße?q=café&emoji=🙂'),
  url('https://bücher.example/katalog'),
  url("https://example.com/a'b(c)*!~?x=<tag>&y=\"quoted\""),
  longUrl(1000),
]

describe('SVG export decodes to the exact payload', () => {
  for (const text of FIXTURES) {
    it(`${text.slice(0, 70)}${text.length > 70 ? '…' : ''}`, async () => {
      const qr = build(text)
      expect(await decodeSvg(svgFor(qr, DESIGN), qr.matrix.size > 100 ? 1200 : 600)).toEqual({ jsqr: text, zxing: text })
    })
  }

  it.each(LEVELS)('at error-correction level %s', async (level) => {
    const text = FIXTURES[2]!
    const qr = build(text, level)
    expect(qr.matrix.errorCorrection).toBe(level)
    expect(await decodeSvg(svgFor(qr, DESIGN))).toEqual({ jsqr: text, zxing: text })
  })
})

describe('every style scans', () => {
  const text = FIXTURES[2]!
  for (const style of QR_STYLES) {
    for (const gradient of [false, true]) {
      it(`${style.name}${gradient ? ' with gradient' : ''}`, async () => {
        const design: QrDesign = { ...DESIGN, style: style.id, ...style.palette, gradient }
        const qr = build(text)
        const svg = svgFor(qr, design, 700)
        if (gradient) expect(svg).toContain('<linearGradient')
        expect(await decodeSvg(svg, 700)).toEqual({ jsqr: text, zxing: text })
        expect(await decodePng(pngFor(qr, design, 512))).toEqual({ jsqr: text, zxing: text })
      })
    }
  }

  it('with custom colors', async () => {
    const qr = build(text)
    const svg = svgFor(qr, { ...DESIGN, foreground: '#1e3a8a', background: '#fef9ec' })
    expect(svg).toContain('fill="#1e3a8a"')
    expect(svg).toContain('fill="#fef9ec"')
    expect(await decodeSvg(svg)).toEqual({ jsqr: text, zxing: text })
  })

  it('with inverted (light-on-dark) colors', async () => {
    const qr = build(FIXTURES[0]!)
    const decoded = await decodePng(pngFor(qr, { ...DESIGN, foreground: '#ffffff', background: '#111111' }, 512))
    expect(decoded).toEqual({ jsqr: FIXTURES[0], zxing: FIXTURES[0] })
  })
})

describe('logo', () => {
  const text = FIXTURES[2]!
  const logo = logoDataUrl()

  it.each([10, 20, 25])('at %i%% with level H scans in every style', async (size) => {
    for (const style of QR_STYLES) {
      const design: QrDesign = { ...DESIGN, style: style.id, ...style.palette, logo: { src: logo, size, clear: true } }
      const qr = build(text, 'H')
      const svg = svgFor(qr, design, 700)
      expect(svg).toContain('<image href="data:image/png;base64,')
      expect(await decodeSvg(svg, 700), `${style.name} at ${size}%`).toEqual({ jsqr: text, zxing: text })
    }
  })

  it('clears the modules behind it', () => {
    const qr = build(text, 'H')
    const without = buildSvgSpec(qr.matrix, DESIGN)
    const cleared = buildSvgSpec(qr.matrix, { ...DESIGN, logo: { src: logo, size: 20, clear: true } })
    const covered = buildSvgSpec(qr.matrix, { ...DESIGN, logo: { src: logo, size: 20, clear: false } })
    expect(cleared.modules.length).toBeLessThan(without.modules.length)
    expect(covered.modules).toBe(without.modules)
  })
})

describe('PNG geometry decodes at every size', () => {
  for (const size of [256, 512, 1024, 2048]) {
    it(`at ${size}px`, async () => {
      const text = FIXTURES[3]!
      const png = pngFor(build(text), DESIGN, size)
      expect(pngToPixels(png).width).toBe(size)
      expect(await decodePng(png)).toEqual({ jsqr: text, zxing: text })
    })
  }

  it('for a long URL near capacity at level L', async () => {
    const text = longUrl(2800)
    const qr = build(text, 'L')
    expect(qr.matrix.version).toBeGreaterThanOrEqual(39)
    expect(await decodePng(pngFor(qr, DESIGN, 2048))).toEqual({ jsqr: text, zxing: text })
  })
})

describe('quiet zone', () => {
  it.each([4, 8, 16])('is background-only and at least %i modules wide', (margin) => {
    const qr = build(FIXTURES[2]!)
    const png = pngFor(qr, { ...DESIGN, margin }, 1024)
    const image = pngToPixels(png)
    const { moduleSize, offset } = computeRasterLayout(qr.matrix.size, 1024, margin)
    expect(offset).toBeGreaterThanOrEqual(margin * moduleSize)
    const isWhite = (x: number, y: number) => image.data[(y * image.width + x) * 4] === 255
    for (let i = 0; i < image.width; i += 3) {
      for (let d = 0; d < margin * moduleSize; d += 2) {
        expect(isWhite(i, d)).toBe(true)
        expect(isWhite(d, i)).toBe(true)
        expect(isWhite(i, image.height - 1 - d)).toBe(true)
        expect(isWhite(image.width - 1 - d, i)).toBe(true)
      }
    }
  })

  it('SVG viewBox includes the margin on every side', () => {
    const qr = build(FIXTURES[0]!)
    for (const margin of [QUIET_ZONE_MODULES, 10]) {
      const total = qr.matrix.size + 2 * margin
      const svg = svgFor(qr, { ...DESIGN, margin }, 256)
      expect(svg).toContain(`viewBox="0 0 ${total} ${total}"`)
      expect(svg).toContain(`d="M${margin} ${margin}h`)
    }
  })
})

describe('QR types decode to their standard payloads', () => {
  const cases: [QrType, Partial<QrForms[QrType]>, string][] = [
    ['text', { text: 'Hello, world!\nLine two · ünïcode ✓' }, 'Hello, world!\nLine two · ünïcode ✓'],
    ['wifi', { ssid: 'Home; "Mesh"', password: 'p@ss:word,1', security: 'WPA', hidden: true }, 'WIFI:T:WPA;S:Home\\; \\"Mesh\\";P:p@ss\\:word\\,1;H:true;;'],
    ['wifi', { ssid: 'Guest', password: '', security: 'nopass', hidden: false }, 'WIFI:T:nopass;S:Guest;;'],
    [
      'contact',
      { firstName: 'Ada', lastName: 'Lovelace', phone: '+44 20 7946 0958', email: 'ada@example.com', organization: 'Analytical Engines, Ltd.', website: 'example.com' },
      'BEGIN:VCARD\r\nVERSION:3.0\r\nN:Lovelace;Ada;;;\r\nFN:Ada Lovelace\r\nORG:Analytical Engines\\, Ltd.\r\nTEL;TYPE=CELL:+442079460958\r\nEMAIL:ada@example.com\r\nURL:https://example.com/\r\nEND:VCARD',
    ],
    ['email', { to: 'team@example.com', subject: 'Hi & welcome', body: 'Line 1\nLine 2' }, 'mailto:team@example.com?subject=Hi%20%26%20welcome&body=Line%201%0ALine%202'],
    ['phone', { number: '+1 (555) 010-9999' }, 'tel:+15550109999'],
  ]

  it.each(cases)('%s', async (type, form, expected) => {
    const forms = { ...EMPTY_FORMS, [type]: { ...EMPTY_FORMS[type], ...form } } as QrForms
    const result = encodeContent(type, forms)
    if (!result.ok) throw new Error(result.error)
    expect(result.content.text).toBe(expected)
    const qr = build(result.content.text)
    expect(await decodeSvg(svgFor(qr, DESIGN), 700)).toEqual({ jsqr: expected, zxing: expected })
  })
})

describe('automatic version selection', () => {
  it('uses the smallest version that fits and grows with data and error correction', () => {
    expect(build('https://a.co', 'L').matrix.version).toBe(1)
    let previous = 0
    for (const length of [20, 100, 300, 800, 1500, 2300]) {
      const version = build(longUrl(length), 'L').matrix.version
      expect(version).toBeGreaterThanOrEqual(previous)
      previous = version
    }
    const text = longUrl(300)
    const versions = LEVELS.map((level) => build(text, level).matrix.version)
    expect([...versions].sort((a, b) => a - b)).toEqual(versions)
    expect(versions[3]).toBeGreaterThan(versions[0]!)
  })

  it('reports payload bytes and total codewords for the symbol', () => {
    const qr = build('https://example.com/pricing?plan=team&seats=5', 'M')
    expect(qr.dataBytes).toBe(45)
    expect(qr.matrix.version).toBe(4)
    expect(qr.matrix.totalCodewords).toBe(100)
    expect(build('ü', 'M').dataBytes).toBe(2)
  })

  it('picks a mask pattern automatically', () => {
    const masks = new Set(FIXTURES.map((text) => build(text).matrix.maskPattern))
    expect(masks.size).toBeGreaterThan(1)
  })
})

describe('capacity limits', () => {
  it.each(LEVELS)('rejects content longer than the level %s maximum with a helpful error', (level) => {
    expect(buildQrCode(longUrl(MAX_URL_LENGTH[level]), level).ok).toBe(true)
    const tooLong = buildQrCode(longUrl(MAX_URL_LENGTH[level] + 1), level)
    expect(tooLong.ok).toBe(false)
    if (!tooLong.ok) {
      expect(tooLong.code).toBe('too-long')
      expect(tooLong.error).toMatch(/too long for a QR code at level/)
      expect(tooLong.error).toContain(`level ${level}`)
    }
  })
})
