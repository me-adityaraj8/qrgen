export type ErrorCorrectionLevel = 'L' | 'M' | 'Q' | 'H'

/** Pixel width/height of exported files. */
export type ExportSize = 256 | 512 | 1024 | 2048

export type ExportFormat = 'png' | 'svg'

/** What a code encodes. Each has its own form and payload format. */
export type QrType = 'url' | 'text' | 'wifi' | 'contact' | 'email' | 'phone'

export type WifiSecurity = 'WPA' | 'WEP' | 'nopass'

export interface QrForms {
  url: { url: string }
  text: { text: string }
  wifi: { ssid: string; password: string; security: WifiSecurity; hidden: boolean }
  contact: { firstName: string; lastName: string; phone: string; email: string; organization: string; website: string }
  email: { to: string; subject: string; body: string }
  phone: { number: string }
}

/** A validated payload, ready to encode. */
export interface EncodedContent {
  type: QrType
  /** The exact string stored in the QR code. */
  text: string
  /** Human-readable summary, e.g. the URL or "Wi-Fi · Home". */
  label: string
  /** Source for the download filename. */
  slug: string
}

export type ContentValidation =
  | { ok: true; content: EncodedContent }
  | { ok: false; error: string; /** Form field the error belongs to. */ field?: string }

/** Visual templates: module shape, eye shape and a starting palette. */
export type QrStyleId = 'classic' | 'rounded' | 'dots' | 'galaxy' | 'neon' | 'minimal'

export type ModuleShape = 'square' | 'rounded' | 'dot' | 'inset'
export type EyeShape = 'square' | 'rounded'

export interface QrSettings {
  style: QrStyleId
  /** Module color (gradient start when `gradient` is on), normalized `#rrggbb`. */
  foreground: string
  /** Background and quiet-zone color, normalized `#rrggbb`. */
  background: string
  gradient: boolean
  /** Gradient end color. */
  gradientTo: string
  errorCorrection: ErrorCorrectionLevel
  size: ExportSize
  /** Quiet zone in modules (at least 4). */
  margin: number
  /** Logo width as a percentage of the symbol width. */
  logoSize: number
  /** Remove modules behind the logo so it sits on a clean background. */
  logoClear: boolean
}

export interface QrLogo {
  /** data: URL of the uploaded image. */
  src: string
  /** Percentage of the symbol width. */
  size: number
  clear: boolean
}

/** Everything that affects how a code looks (but not what it encodes). */
export interface QrDesign {
  style: QrStyleId
  foreground: string
  background: string
  gradient: boolean
  gradientTo: string
  margin: number
  logo: QrLogo | null
}

/** Square module grid produced by the QR encoder, without the quiet zone. */
export interface QrMatrix {
  /** Modules per side (21 for version 1, 177 for version 40). */
  size: number
  /** Row-major, `1` = dark module. Length is `size * size`. */
  modules: Uint8Array
  version: number
  errorCorrection: ErrorCorrectionLevel
  maskPattern: number
  /** Data plus error-correction codewords in this symbol (bytes). */
  totalCodewords: number
}

/** A generated code together with the exact text it encodes. */
export interface QrCode {
  text: string
  /** UTF-8 size of `text`. */
  dataBytes: number
  matrix: QrMatrix
}

export type QrBuildResult =
  | { ok: true; qr: QrCode }
  | { ok: false; code: 'too-long' | 'unknown'; error: string }

export type UrlErrorCode =
  | 'empty'
  | 'whitespace'
  | 'unsupported-scheme'
  | 'invalid'
  | 'invalid-host'

export type UrlValidation =
  | { ok: true; url: string }
  | { ok: false; code: UrlErrorCode; error: string }

/** What the popup knows about the tab it was opened on. */
export type ActiveTabState =
  | { status: 'loading' }
  | { status: 'ready'; url: string }
  /** The tab has a URL, but not one that can be opened on another device. */
  | { status: 'unsupported'; url: string; reason: string }
  /** No tab URL is available (no permission, no tab, or not running as an extension). */
  | { status: 'unavailable' }

/** A code the user downloaded or copied, kept locally for reuse. */
export interface HistoryEntry {
  id: string
  createdAt: number
  type: QrType
  label: string
  /** Encoded text. For Wi-Fi the password is removed before saving. */
  text: string
  form: QrForms[QrType]
  design: Pick<QrSettings, 'style' | 'foreground' | 'background' | 'gradient' | 'gradientTo' | 'errorCorrection' | 'margin'>
  /** Set when a Wi-Fi password was left out of history. */
  passwordOmitted?: boolean
}
