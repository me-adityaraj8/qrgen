/** Center-logo uploads: small raster or SVG images, kept locally as data URLs. */
export const LOGO_STORAGE_KEY = 'qrLogo'
export const LOGO_MAX_BYTES = 1024 * 1024
export const LOGO_TYPES = ['image/png', 'image/jpeg', 'image/svg+xml', 'image/webp'] as const

export class LogoError extends Error {
  override name = 'LogoError'
}

const readAsDataUrl = (file: Blob) =>
  new Promise<string>((resolve, reject) => {
    const reader = new FileReader()
    reader.onload = () => resolve(String(reader.result))
    reader.onerror = () => reject(new LogoError("Couldn't read that file."))
    reader.readAsDataURL(file)
  })

const decodes = (src: string) =>
  new Promise<boolean>((resolve) => {
    const image = new Image()
    image.onload = () => resolve(image.naturalWidth > 0 || src.startsWith('data:image/svg+xml'))
    image.onerror = () => resolve(false)
    image.src = src
  })

/** Validates type and size, then returns the image as a data URL. */
export async function readLogoFile(file: File): Promise<string> {
  if (!(LOGO_TYPES as readonly string[]).includes(file.type)) {
    throw new LogoError('Use a PNG, JPG, WebP or SVG image.')
  }
  if (file.size > LOGO_MAX_BYTES) throw new LogoError('Logos can be at most 1 MB.')
  const src = await readAsDataUrl(file)
  if (!(await decodes(src))) throw new LogoError("That image couldn't be opened.")
  return src
}

export const sanitizeLogo = (value: unknown): string | null =>
  typeof value === 'string' && /^data:image\/(png|jpeg|svg\+xml|webp);base64,/.test(value) ? value : null
