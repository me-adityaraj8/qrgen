import { describe, expect, it } from 'vitest'
import { normalizeUrl, unsupportedTabReason } from './url'

const ok = (input: string) => {
  const result = normalizeUrl(input)
  if (!result.ok) throw new Error(`expected "${input}" to be valid: ${result.error}`)
  return result.url
}

const code = (input: string) => {
  const result = normalizeUrl(input)
  return result.ok ? 'ok' : result.code
}

describe('normalizeUrl', () => {
  it('accepts full http and https URLs unchanged apart from canonical form', () => {
    expect(ok('https://example.com/path?a=1')).toBe('https://example.com/path?a=1')
    expect(ok('http://example.com')).toBe('http://example.com/')
    expect(ok('HTTPS://Example.COM/Path')).toBe('https://example.com/Path')
  })

  it('trims surrounding whitespace', () => {
    expect(ok('  https://example.com/  \n')).toBe('https://example.com/')
  })

  it('adds https:// when no scheme is given', () => {
    expect(ok('example.com')).toBe('https://example.com/')
    expect(ok('www.example.com/docs?x=1#top')).toBe('https://www.example.com/docs?x=1#top')
    expect(ok('localhost:3000/app')).toBe('https://localhost:3000/app')
    expect(ok('example.com:8080')).toBe('https://example.com:8080/')
    expect(ok('192.168.1.10/admin')).toBe('https://192.168.1.10/admin')
  })

  it('keeps query parameters, fragments and encoded characters intact', () => {
    const url = 'https://example.com/search?q=a%26b&tags=x,y&redirect=https%3A%2F%2Fexample.org%2F#results'
    expect(ok(url)).toBe(url)
    expect(ok('https://example.com/?a=1&a=2&empty=&flag')).toBe('https://example.com/?a=1&a=2&empty=&flag')
  })

  it('percent-encodes non-ASCII so the payload is plain ASCII', () => {
    expect(ok('https://example.com/über?q=café')).toBe('https://example.com/%C3%BCber?q=caf%C3%A9')
    expect(ok('https://bücher.de/')).toBe('https://xn--bcher-kva.de/')
    expect(ok('https://example.com/#señal')).toBe('https://example.com/#se%C3%B1al')
    expect(ok('https://example.com/emoji/🙂')).toMatch(/^[\x20-\x7e]+$/)
  })

  it('accepts dotless hosts only when the scheme is explicit', () => {
    expect(ok('http://intranet/wiki')).toBe('http://intranet/wiki')
    expect(code('intranet')).toBe('invalid-host')
    expect(code('example')).toBe('invalid-host')
    expect(code('example.')).toBe('invalid-host')
    expect(code('example.c')).toBe('invalid-host')
  })

  it('accepts IPv6 literals', () => {
    expect(ok('http://[::1]:8080/')).toBe('http://[::1]:8080/')
    expect(ok('[::1]:3000')).toBe('https://[::1]:3000/')
  })

  it('rejects empty input', () => {
    expect(code('')).toBe('empty')
    expect(code('   ')).toBe('empty')
  })

  it('rejects inner whitespace', () => {
    expect(code('https://example.com/a b')).toBe('whitespace')
    expect(code('hello world')).toBe('whitespace')
    expect(code('https://example.com/\nnext')).toBe('whitespace')
  })

  it('rejects schemes other than http and https', () => {
    for (const input of ['javascript:alert(1)', 'mailto:me@example.com', 'ftp://example.com', 'chrome://settings', 'file:///etc/hosts', 'data:text/html,hi']) {
      expect(code(input)).toBe('unsupported-scheme')
    }
    const result = normalizeUrl('javascript:alert(1)')
    expect(!result.ok && result.error).toContain('javascript:')
  })

  it('rejects malformed URLs', () => {
    expect(code('https://')).toBe('invalid')
    expect(code('http://exa mple.com')).toBe('whitespace')
    expect(code('https://exa<mple.com')).toBe('invalid')
    expect(code('example.com:abc')).toBe('invalid')
  })

  it('handles very long URLs without truncation', () => {
    const long = `https://example.com/?data=${'x'.repeat(5000)}`
    expect(ok(long)).toBe(long)
  })
})

describe('unsupportedTabReason', () => {
  it('allows web pages', () => {
    expect(unsupportedTabReason('https://example.com/')).toBeNull()
    expect(unsupportedTabReason('http://localhost:5173/')).toBeNull()
  })

  it('explains browser-internal and local pages', () => {
    expect(unsupportedTabReason('chrome://extensions/')).toMatch(/browser pages/i)
    expect(unsupportedTabReason('chrome-extension://abc/popup.html')).toMatch(/browser pages/i)
    expect(unsupportedTabReason('about:blank')).toMatch(/browser pages/i)
    expect(unsupportedTabReason('file:///Users/me/doc.pdf')).toMatch(/local files/i)
    expect(unsupportedTabReason('view-source:https://example.com')).toMatch(/isn't a web link/)
    expect(unsupportedTabReason('not a url')).toMatch(/isn't a web link/)
  })
})
