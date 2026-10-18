import type { ContentValidation, EncodedContent, QrForms, QrType } from '../types'
import { normalizeUrl } from './url'

export const QR_TYPES: readonly { id: QrType; name: string; description: string }[] = [
  { id: 'url', name: 'URL', description: 'Open a website' },
  { id: 'text', name: 'Text', description: 'Plain text' },
  { id: 'wifi', name: 'Wi-Fi', description: 'Join a network' },
  { id: 'contact', name: 'Contact', description: 'Save a vCard' },
  { id: 'email', name: 'Email', description: 'Send an email' },
  { id: 'phone', name: 'Phone', description: 'Make a call' },
]

export const EMPTY_FORMS: QrForms = Object.freeze({
  url: { url: '' },
  text: { text: '' },
  wifi: { ssid: '', password: '', security: 'WPA', hidden: false },
  contact: { firstName: '', lastName: '', phone: '', email: '', organization: '', website: '' },
  email: { to: '', subject: '', body: '' },
  phone: { number: '' },
}) as QrForms

export const utf8Length = (value: string) => new TextEncoder().encode(value).length

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]+$/

const fail = (error: string, field?: string): ContentValidation => ({ ok: false, error, field })
const ok = (content: EncodedContent): ContentValidation => ({ ok: true, content })

/** Backslash-escapes the characters the WIFI: format reserves. */
export const escapeWifi = (value: string) => value.replace(/([\\;,:"])/g, '\\$1')

/** vCard 3.0 text-value escaping. */
export const escapeVcard = (value: string) =>
  value.replace(/\\/g, '\\\\').replace(/\r?\n/g, '\\n').replace(/([,;])/g, '\\$1')

/** Accepts digits with spaces, dashes, dots or parentheses and an optional leading +. */
export function normalizePhone(raw: string): string | null {
  const value = raw.trim()
  if (!/^\+?[\d\s().-]+$/.test(value)) return null
  const digits = value.replace(/\D/g, '')
  if (digits.length < 3 || digits.length > 15) return null
  return `${value.startsWith('+') ? '+' : ''}${digits}`
}

const PHONE_ERROR = 'Enter a phone number using digits, spaces, dashes or a leading +.'

function encodeUrl({ url }: QrForms['url']): ContentValidation {
  const result = normalizeUrl(url)
  if (!result.ok) return fail(result.error, 'url')
  return ok({ type: 'url', text: result.url, label: result.url, slug: result.url })
}

function encodeText({ text }: QrForms['text']): ContentValidation {
  if (!text.trim()) return fail('Enter some text to encode.', 'text')
  const normalized = text.replace(/\r\n?/g, '\n')
  const firstLine = normalized.trim().split('\n')[0]!
  return ok({ type: 'text', text: normalized, label: firstLine.slice(0, 80), slug: firstLine.split(/\s+/).slice(0, 5).join(' ') })
}

function encodeWifi({ ssid, password, security, hidden }: QrForms['wifi']): ContentValidation {
  if (!ssid.trim()) return fail('Enter the network name (SSID).', 'ssid')
  if (utf8Length(ssid) > 32) return fail('Network names can be at most 32 bytes.', 'ssid')
  if (security === 'WPA' && (password.length < 8 || password.length > 63)) {
    return fail('WPA passwords are 8 to 63 characters.', 'password')
  }
  if (security === 'WEP' && !/^(.{5}|.{13}|[0-9a-f]{10}|[0-9a-f]{26})$/i.test(password)) {
    return fail('WEP keys are 5 or 13 characters, or 10 or 26 hex digits.', 'password')
  }
  const text = buildWifiText({ ssid, password, security, hidden })
  return ok({ type: 'wifi', text, label: `Wi-Fi · ${ssid}`, slug: `wifi ${ssid}` })
}

/** WIFI:T:<security>;S:<ssid>;P:<password>;H:true;; (ZXing / Android / iOS format). */
function buildWifiText({ ssid, password, security, hidden }: QrForms['wifi'], includePassword = true): string {
  return (
    `WIFI:T:${security};S:${escapeWifi(ssid)};` +
    (security === 'nopass' || !includePassword ? '' : `P:${escapeWifi(password)};`) +
    (hidden ? 'H:true;' : '') +
    ';'
  )
}

function encodeContact(form: QrForms['contact']): ContentValidation {
  const first = form.firstName.trim()
  const last = form.lastName.trim()
  const name = [first, last].filter(Boolean).join(' ')
  if (!name) return fail('Enter a name.', 'firstName')
  const phone = form.phone.trim() ? normalizePhone(form.phone) : ''
  if (phone === null) return fail(PHONE_ERROR, 'phone')
  const email = form.email.trim()
  if (email && !EMAIL_PATTERN.test(email)) return fail('Enter a valid email address.', 'email')
  if (!phone && !email) return fail('Add a phone number or an email address.', 'phone')
  let website = ''
  if (form.website.trim()) {
    const result = normalizeUrl(form.website)
    if (!result.ok) return fail(result.error, 'website')
    website = result.url
  }
  const organization = form.organization.trim()
  const lines = [
    'BEGIN:VCARD',
    'VERSION:3.0',
    `N:${escapeVcard(last)};${escapeVcard(first)};;;`,
    `FN:${escapeVcard(name)}`,
    organization && `ORG:${escapeVcard(organization)}`,
    phone && `TEL;TYPE=CELL:${phone}`,
    email && `EMAIL:${email}`,
    website && `URL:${website}`,
    'END:VCARD',
  ].filter(Boolean)
  return ok({ type: 'contact', text: lines.join('\r\n'), label: name, slug: `contact ${name}` })
}

function encodeEmail({ to, subject, body }: QrForms['email']): ContentValidation {
  const address = to.trim()
  if (!EMAIL_PATTERN.test(address)) return fail('Enter a valid email address.', 'to')
  const params = [
    subject.trim() && `subject=${encodeURIComponent(subject.trim())}`,
    body.trim() && `body=${encodeURIComponent(body.replace(/\r\n?/g, '\n'))}`,
  ].filter(Boolean)
  const text = `mailto:${address}${params.length ? `?${params.join('&')}` : ''}`
  return ok({ type: 'email', text, label: `Email · ${address}`, slug: `email ${address}` })
}

function encodePhone({ number }: QrForms['phone']): ContentValidation {
  if (!number.trim()) return fail('Enter a phone number.', 'number')
  const phone = normalizePhone(number)
  if (!phone) return fail(PHONE_ERROR, 'number')
  return ok({ type: 'phone', text: `tel:${phone}`, label: number.trim(), slug: `phone ${phone}` })
}

/** Validates a form and builds the standard payload for its type. */
export function encodeContent(type: QrType, forms: QrForms): ContentValidation {
  switch (type) {
    case 'url':
      return encodeUrl(forms.url)
    case 'text':
      return encodeText(forms.text)
    case 'wifi':
      return encodeWifi(forms.wifi)
    case 'contact':
      return encodeContact(forms.contact)
    case 'email':
      return encodeEmail(forms.email)
    case 'phone':
      return encodePhone(forms.phone)
  }
}

/** The Wi-Fi form and payload without the password, for storing in history. */
export function redactWifi(form: QrForms['wifi']): { form: QrForms['wifi']; text: string } {
  return { form: { ...form, password: '' }, text: buildWifiText(form, false) }
}
