/**
 * End-to-end tests against the production build (dist/) loaded into Chrome for
 * Testing. The popup is opened by simulating a click on the toolbar button, so
 * the real `activeTab` grant is exercised. Downloaded and copied images are
 * decoded with two independent QR decoders (jsQR and ZXing).
 */
import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { PNG } from 'pngjs'
import type { Page } from 'puppeteer'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { filenameFor } from '../../src/lib/filename'
import { computeRasterLayout } from '../../src/lib/render'
import { decodePng, decodeSvg, pngToPixels } from '../decode'
import { ARTIFACTS, DIST, launch, openPopupFor, ROOT, setInput, waitForDownload, type Harness } from './harness'

let h: Harness
const externalRequests: string[] = []

beforeAll(async () => {
  h = await launch()
})

afterAll(async () => {
  await h?.close()
})

/** Opens the popup and records any request that leaves the extension. */
async function open(url: string) {
  const result = await openPopupFor(h, url)
  result.popup.on('request', (request) => {
    if (!/^(chrome-extension|data|blob):/.test(request.url())) externalRequests.push(request.url())
  })
  await result.popup.waitForSelector('.preview:not([data-status="loading"])')
  return result
}

const text = (popup: Page, selector: string) => popup.$eval(selector, (el) => el.textContent?.trim() ?? '')
const status = (popup: Page) => text(popup, '.preview .status')
const previewSvg = (popup: Page) => popup.$eval('.qr-graphic', (svg) => svg.outerHTML)
const previewLabel = (popup: Page) => popup.$eval('.qr-graphic', (svg) => svg.getAttribute('aria-label'))
const fieldError = (popup: Page) => text(popup, '.content-form [role="alert"]')
const ready = (popup: Page) => popup.waitForSelector('.preview[data-status="ready"]')
const settle = (ms = 400) => new Promise((done) => setTimeout(done, ms))
const RESET = '.card-actions .button-ghost'

/** Sets a React-controlled range input. */
async function slide(popup: Page, label: string, value: number) {
  await popup.$eval(
    `input[aria-label="${label}"]`,
    (el, next) => {
      const input = el as HTMLInputElement
      Object.getOwnPropertyDescriptor(HTMLInputElement.prototype, 'value')!.set!.call(input, next)
      input.dispatchEvent(new Event('input', { bubbles: true }))
    },
    String(value),
  )
}

/** Clicks a button and resolves with the text of the toast it produces. */
async function toastAfter(popup: Page, selector: string): Promise<string> {
  await popup.$$eval('.toast', (elements) => elements.forEach((element) => element.setAttribute('data-seen', '')))
  await popup.click(selector)
  const toast = await popup.waitForSelector('.toast:not([data-seen])')
  return toast!.evaluate((element) => element.querySelector('.toast-text')!.textContent ?? '')
}

const download = (popup: Page, format: 'PNG' | 'SVG') => toastAfter(popup, `button[aria-label^="Download ${format}"]`)

async function generateWith(popup: Page, fill: () => Promise<void>) {
  await fill()
  await popup.click('button.generate-button')
  await ready(popup)
}

describe('installation', () => {
  it('ships a Manifest V3 build with minimal permissions', () => {
    const manifest = JSON.parse(readFileSync(join(DIST, 'manifest.json'), 'utf8'))
    const pkg = JSON.parse(readFileSync(join(ROOT, 'package.json'), 'utf8'))
    expect(manifest.manifest_version).toBe(3)
    expect(manifest.name).toBe('QRGen: QR Code Generator')
    expect(manifest.version).toBe(pkg.version)
    expect([...manifest.permissions].sort()).toEqual(['activeTab', 'downloads', 'storage'])
    expect(manifest.host_permissions).toBeUndefined()
    expect(manifest.content_scripts).toBeUndefined()
    expect(manifest.background).toBeUndefined()
    expect(manifest.content_security_policy).toBeUndefined() // default MV3 policy: no remote or inline code
    expect(existsSync(join(DIST, manifest.action.default_popup))).toBe(true)
    for (const icon of Object.values<string>(manifest.icons)) expect(existsSync(join(DIST, icon))).toBe(true)
    expect(manifest.commands._execute_action.suggested_key).toEqual({ default: 'Alt+Shift+Q', mac: 'Alt+Shift+Q' })
  })

  it('popup.html loads only bundled scripts', () => {
    const html = readFileSync(join(DIST, 'popup.html'), 'utf8')
    const scripts = [...html.matchAll(/<script\b[^>]*>/g)].map((match) => match[0])
    expect(scripts.length).toBeGreaterThan(0)
    for (const tag of scripts) expect(tag).toMatch(/src="\.\/assets\/[^"]+\.js"/)
    expect(html).not.toMatch(/<script(?![^>]*\bsrc=)[^>]*>[^<]+<\/script>/)
  })

  it('installs and is enabled in Chrome', () => {
    expect(h.extension.enabled).toBe(true)
    expect(h.extension.name).toBe('QRGen: QR Code Generator')
  })
})

describe('generator', () => {
  let tabUrl: string
  let popup: Page

  it('detects the current tab URL and shows a scannable code', async () => {
    const opened = await open(`${h.baseUrl}/articles/qr-codes?utm_source=test&name=J%C3%BCrgen&tags=a,b#section-2`)
    popup = opened.popup
    tabUrl = opened.tab.url()
    await ready(popup)

    expect(await popup.$eval('.url-row input', (el) => (el as HTMLInputElement).value)).toBe(tabUrl)
    expect(await previewLabel(popup)).toBe(`QR code for ${tabUrl}`)
    expect(await status(popup)).toBe('QR Code Ready')
    expect(await popup.evaluate(() => document.activeElement?.matches('.url-row input'))).toBe(true)
    expect(await popup.evaluate(() => document.documentElement.dataset.theme)).toBe('dark')
    expect(await popup.evaluate(() => document.fonts.check('13px Geist') && document.fonts.check('12px "Geist Mono"'))).toBe(true)

    expect(await decodeSvg(await previewSvg(popup))).toEqual({ jsqr: tabUrl, zxing: tabUrl })
    const onScreen = await (await popup.$('.qr-frame'))!.screenshot()
    expect(await decodePng(onScreen)).toEqual({ jsqr: tabUrl, zxing: tabUrl })
  })

  it('fills Chrome’s 800×600 popup exactly', async () => {
    const size = await popup.evaluate(() => ({
      width: document.documentElement.scrollWidth,
      height: document.documentElement.scrollHeight,
      panelOverflow:
        document.querySelector('.copy-image')!.getBoundingClientRect().bottom - document.querySelector('.preview')!.getBoundingClientRect().bottom,
    }))
    expect(size.width).toBe(800)
    expect(size.height).toBe(600)
    expect(size.panelOverflow).toBeLessThanOrEqual(0)
  })

  it.each([
    ['', 'Enter a URL to generate a QR code.'],
    ['not a url', "URLs can't contain spaces or line breaks."],
    ['ftp://files.example.com', 'Only http:// and https:// links are supported, not ftp:.'],
    ['example', 'Add a domain ending such as .com, or type the full address starting with http://.'],
  ])('validates URL input %j', async (value, message) => {
    await setInput(popup, value, '.url-row input')
    await popup.keyboard.press('Enter')
    expect(await fieldError(popup)).toBe(message)
  })

  it('generates from manual input with query parameters and special characters', async () => {
    const expected = 'https://shop.example.com/search?q=caf%C3%A9&price[min]=10&tags=a,b&next=%2Fcart#results'
    await setInput(popup, 'shop.example.com/search?q=caf%C3%A9&price[min]=10&tags=a,b&next=%2Fcart#results', '.url-row input')
    await popup.keyboard.press('Enter')
    await ready(popup)
    expect(await previewLabel(popup)).toBe(`QR code for ${expected}`)
    expect(await decodeSvg(await previewSvg(popup))).toEqual({ jsqr: expected, zxing: expected })
  })

  it('marks the code out of date while editing and restores the current tab', async () => {
    await popup.focus('.url-row input')
    await popup.keyboard.sendCharacter('&page=2')
    expect(await text(popup, '.stale-chip')).toBe('Press Generate to update')
    expect(await status(popup)).toBe('Out of date: press Generate')
    await popup.click('.url-row .button-secondary')
    await ready(popup)
    expect(await previewLabel(popup)).toBe(`QR code for ${tabUrl}`)
  })

  it.each([
    [
      'Wi-Fi',
      async (page: Page) => {
        await setInput(page, 'Studio; "5G"', 'input[placeholder="Home network"]')
        await setInput(page, 'correct:horse,battery', 'input[placeholder="8 to 63 characters"]')
      },
      'WIFI:T:WPA;S:Studio\\; \\"5G\\";P:correct\\:horse\\,battery;;',
    ],
    [
      'Contact',
      async (page: Page) => {
        await setInput(page, 'Ada', 'input[autocomplete="given-name"]')
        await setInput(page, 'Lovelace', 'input[autocomplete="family-name"]')
        await setInput(page, '+44 20 7946 0958', '.content-form input[type="tel"]')
      },
      'BEGIN:VCARD\r\nVERSION:3.0\r\nN:Lovelace;Ada;;;\r\nFN:Ada Lovelace\r\nTEL;TYPE=CELL:+442079460958\r\nEND:VCARD',
    ],
    [
      'Email',
      async (page: Page) => {
        await setInput(page, 'team@example.com', '.content-form input[type="email"]')
        await setInput(page, 'Hello & welcome', '.content-form input[placeholder="Optional"]')
      },
      'mailto:team@example.com?subject=Hello%20%26%20welcome',
    ],
    ['Phone', async (page: Page) => setInput(page, '+1 (555) 010-9999', '.content-form input[type="tel"]'), 'tel:+15550109999'],
    ['Text', async (page: Page) => setInput(page, 'Meet at gate B7 · 10:30 ✓', '.content-form textarea'), 'Meet at gate B7 · 10:30 ✓'],
  ])('encodes %s content that scans exactly', async (type, fill, expected) => {
    await popup.click(`input[aria-label^="${type}:"]`)
    await generateWith(popup, () => fill(popup))
    expect(await decodeSvg(await previewSvg(popup), 700)).toEqual({ jsqr: expected, zxing: expected })
  })

  it('downloads Wi-Fi as a PNG named after the network and masks the password on screen', async () => {
    await popup.click('input[aria-label^="Wi-Fi:"]')
    await generateWith(popup, async () => {
      await setInput(popup, 'Studio 5G', 'input[placeholder="Home network"]')
      await setInput(popup, 'correct-horse-battery', 'input[placeholder="8 to 63 characters"]')
    })
    const expected = 'WIFI:T:WPA;S:Studio 5G;P:correct-horse-battery;;'
    expect(await text(popup, '.encoded-text')).toBe('WIFI:T:WPA;S:Studio 5G;P:••••••••;;')
    expect(await download(popup, 'PNG')).toBe('Saved qr-wifi-studio-5g.png')
    const png = await waitForDownload(h.downloadDir, 'qr-wifi-studio-5g.png')
    expect(await decodePng(png)).toEqual({ jsqr: expected, zxing: expected })
  })

  it('renders every style so it still scans', async () => {
    // The URL field still holds the tab URL, so Generate (not "Use current tab") brings it back.
    await popup.click('input[aria-label^="URL:"]')
    await popup.click('button.generate-button')
    await ready(popup)
    for (const style of ['Classic', 'Rounded', 'Dots', 'Galaxy', 'Neon', 'Minimal']) {
      await popup.click(`input[aria-label="${style}"]`)
      await settle(450)
      expect(await decodeSvg(await previewSvg(popup), 700), style).toEqual({ jsqr: tabUrl, zxing: tabUrl })
      const onScreen = await (await popup.$('.qr-frame'))!.screenshot()
      expect(await decodePng(onScreen), `${style} on screen`).toEqual({ jsqr: tabUrl, zxing: tabUrl })
    }
  })

  it('downloads a gradient SVG and PNG with the chosen margin and size', async () => {
    await popup.click('input[aria-label="Galaxy"]')
    await slide(popup, 'Margin', 8)
    await slide(popup, 'Export size', 1)
    expect(await popup.$eval('button[aria-label^="Download PNG"]', (el) => el.getAttribute('aria-label'))).toBe('Download PNG, 512 px')

    const svgName = filenameFor({ type: 'url', text: tabUrl, slug: tabUrl }, 'svg')
    expect(await download(popup, 'SVG')).toBe(`Saved ${svgName}`)
    const svg = (await waitForDownload(h.downloadDir, svgName)).toString('utf8')
    expect(svg).toContain('<linearGradient')
    expect(svg).toContain('width="512" height="512"')
    expect(await decodeSvg(svg, 700)).toEqual({ jsqr: tabUrl, zxing: tabUrl })

    const pngName = filenameFor({ type: 'url', text: tabUrl, slug: tabUrl }, 'png')
    expect(await download(popup, 'PNG')).toBe(`Saved ${pngName}`)
    const png = await waitForDownload(h.downloadDir, pngName)
    const pixels = pngToPixels(png)
    expect([pixels.width, pixels.height]).toEqual([512, 512])
    const modules = Number((await text(popup, '.stat .stat-sub')).match(/^(\d+) ×/)![1])
    const { offset, moduleSize } = computeRasterLayout(modules, 512, 8)
    expect(offset).toBeGreaterThanOrEqual(8 * moduleSize)
    const at = (x: number, y: number) => [...pixels.data.slice((y * 512 + x) * 4, (y * 512 + x) * 4 + 3)]
    expect(at(offset - 2, offset - 2)).toEqual([255, 255, 255]) // quiet zone
    expect(await decodePng(png)).toEqual({ jsqr: tabUrl, zxing: tabUrl })
  })

  it('adds a logo, raises error correction and exports files that scan', async () => {
    const logoPath = join(ARTIFACTS, 'logo.png')
    mkdirSync(ARTIFACTS, { recursive: true })
    const logo = new PNG({ width: 64, height: 64 })
    for (let i = 0; i < 64 * 64; i++) logo.data.set([109, 40, 217, 255], i * 4)
    writeFileSync(logoPath, PNG.sync.write(logo))

    await popup.click(RESET)
    const input = await popup.$('input[type="file"]')
    await input!.uploadFile(logoPath)
    await popup.waitForSelector('.qr-graphic image')
    expect(await text(popup, '.toast-text')).toBe('Error correction set to H so the code still scans with a logo.')
    expect(await popup.$eval('input[aria-label="H, High"]', (el) => (el as HTMLInputElement).checked)).toBe(true)

    const pngName = filenameFor({ type: 'url', text: tabUrl, slug: tabUrl }, 'png').replace('.png', ' (1).png')
    expect(await download(popup, 'PNG')).toBe(`Saved ${pngName}`)
    const png = await waitForDownload(h.downloadDir, pngName)
    const pixels = pngToPixels(png)
    const centre = (Math.floor(pixels.height / 2) * pixels.width + Math.floor(pixels.width / 2)) * 4
    expect([...pixels.data.slice(centre, centre + 3)]).toEqual([109, 40, 217]) // the logo
    expect(await decodePng(png)).toEqual({ jsqr: tabUrl, zxing: tabUrl })

    const svgName = filenameFor({ type: 'url', text: tabUrl, slug: tabUrl }, 'svg').replace('.svg', ' (1).svg')
    expect(await download(popup, 'SVG')).toBe(`Saved ${svgName}`)
    const svg = (await waitForDownload(h.downloadDir, svgName)).toString('utf8')
    expect(svg).toContain('<image href="data:image/png;base64,')
    expect(await decodeSvg(svg, 800)).toEqual({ jsqr: tabUrl, zxing: tabUrl })

    await popup.click('.logo-actions .is-danger')
    expect(await popup.$('.qr-graphic image')).toBeNull()
  })

  it('copies the image and the encoded content to the clipboard', async () => {
    await h.browser
      .defaultBrowserContext()
      .overridePermissions(`chrome-extension://${h.extension.id}`, ['clipboard-read', 'clipboard-write', 'clipboard-sanitized-write'])
    expect(await toastAfter(popup, '.copy-image')).toBe('QR image copied to the clipboard')
    const copied = await popup.evaluate(async () => {
      const [item] = await navigator.clipboard.read()
      const blob = await item!.getType('image/png')
      return Array.from(new Uint8Array(await blob.arrayBuffer()))
    })
    expect(await decodePng(Buffer.from(copied))).toEqual({ jsqr: tabUrl, zxing: tabUrl })

    expect(await toastAfter(popup, 'button[aria-label="Copy encoded content"]')).toBe('Encoded content copied')
    expect(await popup.evaluate(() => navigator.clipboard.readText())).toBe(tabUrl)
  })

  it('downloads the latest input even without pressing Generate', async () => {
    const latest = 'https://example.org/fresh?x=1&y=two'
    await setInput(popup, latest, '.url-row input')
    expect(await download(popup, 'SVG')).toBe('Saved qr-example.org-fresh.svg')
    expect(await previewLabel(popup)).toBe(`QR code for ${latest}`)
    const svg = (await waitForDownload(h.downloadDir, 'qr-example.org-fresh.svg')).toString('utf8')
    expect(await decodeSvg(svg)).toEqual({ jsqr: latest, zxing: latest })
    expect(await download(popup, 'SVG')).toBe('Saved qr-example.org-fresh (1).svg')
  })

  it('handles a long URL near capacity and explains one that is too long', async () => {
    const long = `https://example.com/report?data=${'Ab0-_~'.repeat(380)}&end=1`
    await popup.click('input[aria-label="L, Low"]')
    await slide(popup, 'Export size', 3)
    await setInput(popup, long, '.url-row input')
    await popup.keyboard.press('Enter')
    await ready(popup)
    expect(await text(popup, '.capacity')).toMatch(/^2,\d{3} \/ 2,953 bytes$/)
    const name = filenameFor({ type: 'url', text: long, slug: long }, 'png')
    expect(await download(popup, 'PNG')).toBe(`Saved ${name}`)
    const png = await waitForDownload(h.downloadDir, name)
    expect(pngToPixels(png).width).toBe(2048)
    expect(await decodePng(png)).toEqual({ jsqr: long, zxing: long })

    await setInput(popup, `https://example.com/?q=${'x'.repeat(3000)}`, '.url-row input')
    await popup.keyboard.press('Enter')
    expect(await text(popup, '.frame-message.is-error')).toMatch(/too long for a QR code at level L/)
    expect(await status(popup)).toBe("Can't generate")
  })

  it('blocks downloads when contrast is too low', async () => {
    await popup.click('.url-row .button-secondary')
    await ready(popup)
    await setInput(popup, '#eeeeee', '.color-row .color-field:first-child .color-hex')
    expect(await text(popup, '.notice.is-error')).toMatch(/Contrast is 1\.\d:1/)
    expect(await status(popup)).toBe('Low contrast')
    expect(await popup.$eval('button[aria-label^="Download SVG"]', (el) => (el as HTMLButtonElement).disabled)).toBe(true)
    await popup.click(RESET)
  })

  it('keeps history of downloads, restores entries and never stores Wi-Fi passwords', async () => {
    await popup.click('#tab-history')
    const labels = await popup.$$eval('.history-label', (els) => els.map((el) => el.textContent))
    expect(labels[0]).toMatch(/^https:\/\/example\.com\/report/)
    expect(labels).toContain('Wi-Fi · Studio 5G')
    const stored = await popup.evaluate(async () => JSON.stringify(await chrome.storage.local.get('qrHistory')))
    expect(stored).not.toContain('correct-horse-battery')

    await popup.click(`button[aria-label="Open ${tabUrl}"]`)
    await ready(popup)
    expect(await popup.$eval('#tab-generator', (el) => el.getAttribute('aria-selected'))).toBe('true')
    expect(await popup.$eval('.url-row input', (el) => (el as HTMLInputElement).value)).toBe(tabUrl)

    await popup.click('button[aria-label="Settings"]')
    await popup.waitForSelector('.menu:popover-open')
    const labels2 = await popup.$$eval('.menu-item', (els) => els.map((el) => el.textContent?.trim()))
    await (await popup.$$('.menu-item'))[labels2.indexOf('Clear history')]!.click()
    expect(await popup.$('.menu:popover-open')).toBeNull()
    await popup.click('#tab-history')
    expect(await text(popup, '.empty-title')).toBe('No saved codes yet')
    await popup.click('#tab-generator')
  })

  it('registers the keyboard shortcut', async () => {
    const shortcut = await popup.evaluate(async () => (await chrome.commands.getAll()).find((c) => c.name === '_execute_action')?.shortcut)
    expect(shortcut).toMatch(/^(⌥⇧Q|Alt\+Shift\+Q)$/)
  })

  it('remembers style, settings and theme after the popup closes', async () => {
    await popup.click('input[aria-label="Dots"]')
    await popup.click('input[aria-label="Q, Quartile"]')
    await popup.click('button[aria-label="Light theme"]')
    await popup.close()

    const reopened = await open(`${h.baseUrl}/second-page?ref=reopen`)
    popup = reopened.popup
    await ready(popup)
    expect(await popup.evaluate(() => document.documentElement.dataset.theme)).toBe('light')
    expect(await popup.$eval('input[aria-label="Dots"]', (el) => (el as HTMLInputElement).checked)).toBe(true)
    expect(await popup.$eval('input[aria-label="Q, Quartile"]', (el) => (el as HTMLInputElement).checked)).toBe(true)
    expect(await popup.$eval('.url-row input', (el) => (el as HTMLInputElement).value)).toBe(reopened.tab.url())
    await popup.click('button[aria-label="Dark theme"]')
    await popup.click(RESET)
  })

  it('captures screenshots of the main views', async () => {
    const dir = join(ARTIFACTS, 'screenshots')
    mkdirSync(dir, { recursive: true })
    // Headless Chrome gives popups a fixed, smaller window; capture the full 800×600 page.
    const shot = async (name: string) => {
      await popup.evaluate(() => window.scrollTo(0, 0))
      await settle()
      await popup.screenshot({ path: join(dir, `${name}.png`), fullPage: true })
    }
    await popup.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
    await ready(popup)
    await (await popup.$('.url-row input'))!.evaluate((el) => (el as HTMLInputElement).blur())
    await shot('popup-dark')
    await popup.click('input[aria-label="Galaxy"]')
    await popup.$eval('.controls', (el) => el.scrollTo(0, 380))
    await shot('popup-customize')
    await popup.$eval('.controls', (el) => el.scrollTo(0, 0))
    await popup.click('button[aria-label="Light theme"]')
    await shot('popup-light')
    await popup.click('button[aria-label="Dark theme"]')
    await popup.click(RESET)
    await popup.close()
  })
})

describe('tabs that cannot be encoded', () => {
  it.each(['about:blank', 'chrome://version/'])('asks for a URL on %s', async (url) => {
    const { popup } = await open(url)
    expect(await popup.$eval('.url-row input', (el) => (el as HTMLInputElement).value)).toBe('')
    expect(await text(popup, '.form-message')).toMatch(/isn't available to extensions|Browser pages like this one/)
    expect(await status(popup)).toBe('Waiting for content')
    await setInput(popup, 'example.com', '.url-row input')
    await popup.keyboard.press('Enter')
    await ready(popup)
    expect(await previewLabel(popup)).toBe('QR code for https://example.com/')
    await popup.close()
  })
})

describe('privacy and stability', () => {
  it('generated everything locally (no network requests from the popup)', () => {
    expect(externalRequests).toEqual([])
  })

  it('logged no errors in the popup', () => {
    expect(h.popupErrors).toEqual([])
  })
})
