import { describe, expect, it } from 'vitest'
import { assessContrast, contrastRatio, normalizeHex } from './color'
import { buildFilename, filenameFor } from './filename'
import { addEntry, createEntry, HISTORY_LIMIT, relativeTime, sanitizeHistory, sanitizePrefs } from './history'
import { EMPTY_FORMS, encodeContent, escapeVcard, escapeWifi, normalizePhone } from './payload'
import { buildQrCode } from './qr'
import { buildSvgSpec, computeRasterLayout, toSvgString } from './render'
import { COLOR_SWATCHES, DEFAULT_SETTINGS, isDefaultSettings, QR_STYLES, sanitizeSettings } from './settings'
import type { QrForms, QrType } from '../types'

const forms = <T extends QrType>(type: T, patch: Partial<QrForms[T]>): QrForms =>
  ({ ...EMPTY_FORMS, [type]: { ...EMPTY_FORMS[type], ...patch } }) as QrForms

describe('color', () => {
  it('normalizes hex colors', () => {
    expect(normalizeHex('#ABC')).toBe('#aabbcc')
    expect(normalizeHex('abc')).toBe('#aabbcc')
    expect(normalizeHex(' #12AbEf ')).toBe('#12abef')
    expect(normalizeHex('#12345')).toBeNull()
    expect(normalizeHex('red')).toBeNull()
  })

  it('computes WCAG contrast ratios', () => {
    expect(contrastRatio('#000000', '#ffffff')).toBeCloseTo(21, 5)
    expect(contrastRatio('#ffffff', '#ffffff')).toBeCloseTo(1, 5)
  })

  it('blocks low contrast, checks every gradient stop and flags inverted colors', () => {
    expect(assessContrast('#000000', '#ffffff').level).toBe('ok')
    expect(assessContrast('#bbbbbb', '#ffffff').level).toBe('too-low')
    expect(assessContrast(['#6d28d9', '#2563eb'], '#ffffff').level).toBe('ok')
    expect(assessContrast(['#6d28d9', '#dddddd'], '#ffffff').level).toBe('too-low')
    expect(assessContrast('#ffffff', '#000000').level).toBe('inverted')
  })

  it('keeps every style palette and swatch readable on white', () => {
    for (const style of QR_STYLES) {
      const stops = style.palette.gradient ? [style.palette.foreground, style.palette.gradientTo] : style.palette.foreground
      expect(assessContrast(stops, style.palette.background).ratio, style.name).toBeGreaterThanOrEqual(4.5)
    }
    for (const swatch of COLOR_SWATCHES) expect(contrastRatio(swatch.value, '#ffffff'), swatch.name).toBeGreaterThanOrEqual(4.5)
  })
})

describe('payload encoders', () => {
  it('validates each type with field-level errors', () => {
    expect(encodeContent('text', forms('text', { text: '   ' }))).toMatchObject({ ok: false, field: 'text' })
    expect(encodeContent('wifi', forms('wifi', { ssid: '' }))).toMatchObject({ ok: false, field: 'ssid' })
    expect(encodeContent('wifi', forms('wifi', { ssid: 'Home', password: 'short' }))).toMatchObject({ ok: false, field: 'password' })
    expect(encodeContent('wifi', forms('wifi', { ssid: 'Home', security: 'WEP', password: 'abc' }))).toMatchObject({ ok: false, field: 'password' })
    expect(encodeContent('wifi', forms('wifi', { ssid: 'x'.repeat(33), password: '12345678' }))).toMatchObject({ ok: false, field: 'ssid' })
    expect(encodeContent('contact', forms('contact', { firstName: '' }))).toMatchObject({ ok: false, field: 'firstName' })
    expect(encodeContent('contact', forms('contact', { firstName: 'Ada' }))).toMatchObject({ ok: false, field: 'phone' })
    expect(encodeContent('contact', forms('contact', { firstName: 'Ada', email: 'nope' }))).toMatchObject({ ok: false, field: 'email' })
    expect(encodeContent('email', forms('email', { to: 'not-an-email' }))).toMatchObject({ ok: false, field: 'to' })
    expect(encodeContent('phone', forms('phone', { number: 'call me' }))).toMatchObject({ ok: false, field: 'number' })
    expect(encodeContent('url', forms('url', { url: 'javascript:alert(1)' }))).toMatchObject({ ok: false, field: 'url' })
  })

  it('accepts WEP keys of valid lengths and open networks without a password', () => {
    expect(encodeContent('wifi', forms('wifi', { ssid: 'Old', security: 'WEP', password: 'abcde' })).ok).toBe(true)
    expect(encodeContent('wifi', forms('wifi', { ssid: 'Old', security: 'WEP', password: '0123456789' })).ok).toBe(true)
    expect(encodeContent('wifi', forms('wifi', { ssid: 'Cafe', security: 'nopass', password: 'ignored' }))).toMatchObject({
      ok: true,
      content: { text: 'WIFI:T:nopass;S:Cafe;;' },
    })
  })

  it('escapes reserved characters', () => {
    expect(escapeWifi('a;b,c:d"e\\f')).toBe('a\\;b\\,c\\:d\\"e\\\\f')
    expect(escapeVcard('Smith, Jones; Co\nLine')).toBe('Smith\\, Jones\\; Co\\nLine')
  })

  it('normalizes phone numbers', () => {
    expect(normalizePhone('+1 (555) 010-9999')).toBe('+15550109999')
    expect(normalizePhone('020 7946 0958')).toBe('02079460958')
    expect(normalizePhone('12')).toBeNull()
    expect(normalizePhone('555-CALL')).toBeNull()
  })

  it('normalizes text line endings and builds readable labels', () => {
    const result = encodeContent('text', forms('text', { text: 'First line\r\nSecond' }))
    expect(result).toMatchObject({ ok: true, content: { text: 'First line\nSecond', label: 'First line' } })
  })
})

describe('filenames', () => {
  it('derives readable, filesystem-safe names from URLs', () => {
    expect(buildFilename('https://www.example.com/', 'png')).toBe('qr-example.com.png')
    expect(buildFilename('https://example.com/blog/my-post?id=1#top', 'svg')).toBe('qr-example.com-blog-my-post.svg')
    expect(buildFilename('not a url', 'png')).toBe('qr-code.png')
  })

  it('names other types after their content', () => {
    const name = (type: QrType, patch: object) => {
      const result = encodeContent(type, forms(type, patch))
      if (!result.ok) throw new Error(result.error)
      return filenameFor(result.content, 'png')
    }
    expect(name('wifi', { ssid: 'Café Wi-Fi', password: '12345678' })).toBe('qr-wifi-cafe-wi-fi.png')
    expect(name('contact', { firstName: 'José', lastName: 'Núñez', phone: '555 0100' })).toBe('qr-contact-jose-nunez.png')
    expect(name('email', { to: 'team@example.com' })).toBe('qr-email-team-example.com.png')
    expect(name('phone', { number: '+1 555 010 9999' })).toBe('qr-phone-15550109999.png')
    expect(name('text', { text: 'Hello there, world and more words' })).toBe('qr-hello-there-world-and-more.png')
    expect(filenameFor({ type: 'text', text: '✓', slug: '✓✓' }, 'svg')).toBe('qr-text.svg')
  })
})

describe('settings', () => {
  it('fills in defaults for missing or invalid stored values', () => {
    expect(sanitizeSettings(undefined)).toEqual(DEFAULT_SETTINGS)
    expect(sanitizeSettings({ foreground: '#ABC', background: 'blue', errorCorrection: 'X', size: 999, margin: 1, logoSize: 90, style: 'bogus' })).toEqual({
      ...DEFAULT_SETTINGS,
      foreground: '#aabbcc',
      margin: 4,
      logoSize: 25,
    })
  })

  it('never lets the margin drop below four modules', () => {
    expect(sanitizeSettings({ margin: 0 }).margin).toBe(4)
    expect(sanitizeSettings({ margin: 40 }).margin).toBe(16)
  })

  it('detects defaults', () => {
    expect(isDefaultSettings({ ...DEFAULT_SETTINGS })).toBe(true)
    expect(isDefaultSettings({ ...DEFAULT_SETTINGS, margin: 6 })).toBe(false)
  })
})

describe('history', () => {
  const settings = { ...DEFAULT_SETTINGS }

  it('never stores Wi-Fi passwords', () => {
    const form = { ...EMPTY_FORMS.wifi, ssid: 'Home', password: 'super-secret-1', security: 'WPA' as const }
    const result = encodeContent('wifi', { ...EMPTY_FORMS, wifi: form })
    if (!result.ok) throw new Error(result.error)
    const entry = createEntry(result.content, form, settings, 1000)
    expect(JSON.stringify(entry)).not.toContain('super-secret-1')
    expect(entry.text).toBe('WIFI:T:WPA;S:Home;;')
    expect(entry.passwordOmitted).toBe(true)
  })

  it('keeps newest first, de-duplicates and caps the list', () => {
    const make = (text: string, at: number) => createEntry({ type: 'text', text, label: text, slug: text }, { text }, settings, at)
    let entries = [make('a', 1), make('b', 2)]
    entries = addEntry(entries, make('a', 3))
    expect(entries.map((entry) => entry.text)).toEqual(['a', 'b'])
    for (let i = 0; i < HISTORY_LIMIT + 5; i++) entries = addEntry(entries, make(`x${i}`, 10 + i))
    expect(entries).toHaveLength(HISTORY_LIMIT)
  })

  it('sanitizes stored data', () => {
    expect(sanitizeHistory('junk')).toEqual([])
    expect(sanitizeHistory([{ id: 1 }, null])).toEqual([])
    expect(sanitizePrefs(undefined)).toEqual({ saveHistory: true })
    expect(sanitizePrefs({ saveHistory: false })).toEqual({ saveHistory: false })
  })

  it('formats relative times', () => {
    const now = 1_000_000_000
    expect(relativeTime(now - 10_000, now)).toBe('Just now')
    expect(relativeTime(now - 5 * 60_000, now)).toBe('5 min ago')
    expect(relativeTime(now - 3 * 3_600_000, now)).toBe('3 h ago')
  })
})

describe('computeRasterLayout', () => {
  it('uses whole-pixel modules, exact output size and the requested quiet zone', () => {
    for (let version = 1; version <= 40; version++) {
      const matrixSize = 17 + version * 4
      for (const target of [256, 512, 1024, 2048]) {
        for (const margin of [4, 16]) {
          const { canvasSize, moduleSize, offset } = computeRasterLayout(matrixSize, target, margin)
          expect(canvasSize).toBeGreaterThanOrEqual(target)
          if (moduleSize * (matrixSize + 2 * margin) <= target) expect(canvasSize).toBe(target)
          expect(Number.isInteger(moduleSize) && moduleSize >= 1).toBe(true)
          expect(offset).toBeGreaterThanOrEqual(margin * moduleSize)
          expect(canvasSize - offset - moduleSize * matrixSize).toBeGreaterThanOrEqual(margin * moduleSize)
        }
      }
    }
  })
})

describe('toSvgString', () => {
  it('escapes the title, embeds the logo and sets the requested size', () => {
    const result = buildQrCode('https://example.com/?a=1&b=<2>', 'H')
    if (!result.ok) throw new Error(result.error)
    const spec = buildSvgSpec(result.qr.matrix, {
      ...DEFAULT_SETTINGS,
      logo: { src: 'data:image/png;base64,AAAA', size: 20, clear: true },
    })
    const svg = toSvgString(spec, { size: 512, title: 'QR code: https://example.com/?a=1&b=<2>', standalone: true })
    expect(svg.startsWith('<?xml')).toBe(true)
    expect(svg).toContain('width="512" height="512"')
    expect(svg).toContain('<title>QR code: https://example.com/?a=1&amp;b=&lt;2&gt;</title>')
    expect(svg).toContain('<image href="data:image/png;base64,AAAA"')
    expect(toSvgString(spec, { omitLogo: true })).not.toContain('<image')
    expect(new DOMParser().parseFromString(svg, 'image/svg+xml').querySelector('parsererror')).toBeNull()
  })
})
