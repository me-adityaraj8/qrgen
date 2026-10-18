import type { EncodedContent, ExportFormat } from '../types'

const MAX_SLUG_LENGTH = 60

/**
 * `https://www.example.com/blog/post?id=1` -> `qr-example.com-blog-post.png`.
 * Only [a-z0-9.-] survive, so the name is safe on every OS.
 */
export function buildFilename(url: string, format: ExportFormat): string {
  let parts: string[] = []
  try {
    const parsed = new URL(url)
    const path = parsed.pathname.split('/').map((segment) => {
      try {
        return decodeURIComponent(segment)
      } catch {
        return segment
      }
    })
    parts = [parsed.hostname.replace(/^www\./, ''), ...path]
  } catch {
    // Fall through to the generic name.
  }
  const slug = parts
    .join('-')
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/[-.]+$/g, '')
  return `${slug ? `qr-${slug}` : 'qr-code'}.${format}`
}

/** Lowercase ASCII slug: accents folded, everything else outside [a-z0-9.-] becomes "-". */
function slugify(value: string): string {
  return value
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9.-]+/g, '-')
    .replace(/-{2,}/g, '-')
    .replace(/^[-.]+|[-.]+$/g, '')
    .slice(0, MAX_SLUG_LENGTH)
    .replace(/[-.]+$/g, '')
}

/** URL codes are named after the page; other types after their summary, e.g. `qr-wifi-home.png`. */
export function filenameFor(content: Pick<EncodedContent, 'type' | 'text' | 'slug'>, format: ExportFormat): string {
  if (content.type === 'url') return buildFilename(content.text, format)
  const slug = slugify(content.slug)
  return `${slug ? `qr-${slug}` : `qr-${content.type}`}.${format}`
}
