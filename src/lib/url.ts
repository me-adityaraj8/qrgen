import type { UrlValidation } from '../types'

const SUPPORTED_PROTOCOLS = new Set(['http:', 'https:'])

const fail = (code: Extract<UrlValidation, { ok: false }>['code'], error: string): UrlValidation => ({
  ok: false,
  code,
  error,
})

/**
 * Returns the explicit scheme of `input` (lowercased, without ":"), or null when
 * the input has no scheme. `localhost:3000` and `example.com:8080` are treated
 * as host:port, not as schemes.
 */
function explicitScheme(input: string): string | null {
  const match = /^([a-z][a-z0-9+.-]*):(.*)$/is.exec(input)
  if (!match) return null
  const scheme = match[1]!.toLowerCase()
  const rest = match[2]!
  if (scheme === 'http' || scheme === 'https') return scheme
  if (rest.startsWith('//')) return scheme
  if (scheme.includes('.')) return null
  // "localhost:3000/path" is host:port, not a scheme.
  if (rest === '' || /^\d+([/?#]|$)/.test(rest)) return null
  return scheme
}

/** Accept hosts that look intentional when the user typed no scheme. */
function isPlausibleHost(hostname: string): boolean {
  if (hostname === 'localhost') return true
  if (hostname.startsWith('[')) return true // IPv6 literal
  if (/^\d{1,3}(\.\d{1,3}){3}$/.test(hostname)) return true
  const labels = hostname.split('.')
  if (labels.length < 2 || labels.some((label) => label.length === 0)) return false
  const tld = labels[labels.length - 1]!
  return /^[a-z][a-z0-9-]{1,62}$/i.test(tld) || /^xn--[a-z0-9-]+$/i.test(tld)
}

/**
 * Validates user input and returns the canonical URL that will be encoded.
 *
 * - Adds `https://` when no scheme is given (`example.com` -> `https://example.com/`).
 * - Only http and https are accepted.
 * - Output is the WHATWG-serialized href: non-ASCII is percent-encoded and
 *   internationalized domains become punycode, so the QR payload is plain ASCII
 *   that every scanner reads the same way.
 */
export function normalizeUrl(raw: string): UrlValidation {
  const input = raw.trim()
  if (!input) return fail('empty', 'Enter a URL to generate a QR code.')
  if (/\s/.test(input)) return fail('whitespace', "URLs can't contain spaces or line breaks.")

  const scheme = explicitScheme(input)
  if (scheme && scheme !== 'http' && scheme !== 'https') {
    return fail('unsupported-scheme', `Only http:// and https:// links are supported, not ${scheme}:.`)
  }

  let parsed: URL
  try {
    parsed = new URL(scheme ? input : `https://${input}`)
  } catch {
    return fail('invalid', "That doesn't look like a valid URL. Try something like https://example.com.")
  }

  if (!SUPPORTED_PROTOCOLS.has(parsed.protocol) || !parsed.hostname) {
    return fail('invalid', "That doesn't look like a valid URL. Try something like https://example.com.")
  }
  if (!scheme && !isPlausibleHost(parsed.hostname)) {
    return fail(
      'invalid-host',
      'Add a domain ending such as .com, or type the full address starting with http://.',
    )
  }

  return { ok: true, url: parsed.href }
}

/** Explains why a tab URL can't be turned into a useful QR code, or returns null if it can. */
export function unsupportedTabReason(url: string): string | null {
  let protocol: string
  try {
    protocol = new URL(url).protocol
  } catch {
    return "This tab's address isn't a web link."
  }
  if (SUPPORTED_PROTOCOLS.has(protocol)) return null
  if (protocol === 'file:') return "Local files can't be opened from another device."
  if (protocol === 'chrome:' || protocol === 'chrome-extension:' || protocol === 'edge:' || protocol === 'about:') {
    return "Browser pages like this one can't be opened from another device."
  }
  return "This tab's address isn't a web link."
}
