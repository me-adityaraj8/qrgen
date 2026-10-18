/**
 * Renders the Chrome Web Store images from the real extension:
 * five 1280×800 screenshots and the 440×280 small promo tile, written to store/.
 *
 *   npm run store-assets
 *
 * Skipped during the normal E2E run.
 */
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { join } from 'node:path'
import { Resvg } from '@resvg/resvg-js'
import type { Page } from 'puppeteer'
import { afterAll, beforeAll, describe, expect, it } from 'vitest'
import { buildQrCode } from '../../src/lib/qr'
import { buildSvgSpec, toSvgString } from '../../src/lib/render'
import { decodePng, pngToPixels } from '../decode'
import { ARTIFACTS, launch, ROOT, setInput, type Harness } from './harness'

const OUT = join(ROOT, 'store')
const FAKE_ORIGIN = 'https://example.com'
const settle = (ms = 500) => new Promise((done) => setTimeout(done, ms))

const font = (file: string) => readFileSync(join(ROOT, 'node_modules/@fontsource-variable', file)).toString('base64')
const FONTS = `
@font-face { font-family: 'Geist'; font-weight: 100 900; src: url(data:font/woff2;base64,${font('geist/files/geist-latin-wght-normal.woff2')}) format('woff2'); }
@font-face { font-family: 'Geist Mono'; font-weight: 100 900; src: url(data:font/woff2;base64,${font('geist-mono/files/geist-mono-latin-wght-normal.woff2')}) format('woff2'); }`

const MARK = `<svg width="34" height="34" viewBox="0 0 32 32"><defs><linearGradient id="m" x1="2" y1="2" x2="30" y2="30" gradientUnits="userSpaceOnUse"><stop offset="0" stop-color="#a78bfa"/><stop offset=".5" stop-color="#7c3aed"/><stop offset="1" stop-color="#3b82f6"/></linearGradient></defs><g fill="none" stroke="url(#m)" stroke-width="3"><rect x="3.5" y="3.5" width="10.5" height="10.5" rx="3"/><rect x="18" y="3.5" width="10.5" height="10.5" rx="3"/><rect x="3.5" y="18" width="10.5" height="10.5" rx="3"/></g><rect x="18" y="18" width="10.5" height="10.5" rx="3" fill="url(#m)"/></svg>`

const BACKDROP = `
  background:
    radial-gradient(640px 420px at 8% 0%, rgb(124 58 237 / .32), transparent 70%),
    radial-gradient(560px 460px at 92% 100%, rgb(59 130 246 / .22), transparent 70%),
    radial-gradient(rgb(255 255 255 / .05) 1px, transparent 1px) 0 0 / 22px 22px,
    #090a13;`

const SHOTS = [
  { file: 'screenshot-1-generator.png', title: 'QR codes for the page you’re on', text: 'Open QRGen on any tab and the code is ready. Edit the link or paste a new one.' },
  { file: 'screenshot-2-wifi.png', title: 'Wi-Fi, contacts, email, phone and text', text: 'Guests scan once to join your network. Wi-Fi passwords are never saved.' },
  { file: 'screenshot-3-style.png', title: 'Your style, your colors, your logo', text: 'Six styles, gradients and a center logo. Every style is tested to scan.' },
  { file: 'screenshot-4-history.png', title: 'Saved codes, one click away', text: 'Downloads and copies are kept in History, only on your device.' },
  { file: 'screenshot-5-light.png', title: 'PNG, SVG or clipboard. Offline.', text: 'No account and no tracking. Everything happens in your browser.' },
]

let h: Harness
let popup: Page
const captures: Buffer[] = []

/** Opens the popup on a tab whose URL looks real; the page itself is served locally. */
async function openOn(url: string) {
  const tab = await h.browser.newPage()
  await tab.setRequestInterception(true)
  tab.on('request', (request) => {
    if (request.url().startsWith(FAKE_ORIGIN)) {
      void request.respond({ status: 200, contentType: 'text/html', body: '<!doctype html><title>Blog</title><h1>Blog</h1>' })
    } else void request.continue()
  })
  await tab.goto(url)
  await tab.bringToFront()
  const target = h.browser.waitForTarget((t) => t.url().startsWith(`chrome-extension://${h.extension.id}/popup.html`))
  await tab.triggerExtensionAction(h.extension)
  const page = await (await target).asPage()
  await page.emulateMediaFeatures([{ name: 'prefers-reduced-motion', value: 'reduce' }])
  await page.waitForSelector('.preview[data-status="ready"]')
  return page
}

/** Full 800×600 popup capture with no focus ring or caret in view. */
async function capture() {
  await popup.evaluate(() => (document.activeElement as HTMLElement | null)?.blur())
  await settle()
  return Buffer.from(await popup.screenshot({ fullPage: true }))
}

const download = async (format: 'PNG' | 'SVG') => {
  await popup.click(`button[aria-label^="Download ${format}"]`)
  await popup.waitForSelector('.toast.is-success')
  await popup.click('.toast-close')
}

const describeStore = process.env.STORE_ASSETS ? describe : describe.skip

describeStore('Chrome Web Store assets', () => {
  beforeAll(async () => {
    h = await launch()
    mkdirSync(OUT, { recursive: true })
  })

  afterAll(async () => {
    await h?.close()
  })

  it('captures popup states', async () => {
    popup = await openOn(`${FAKE_ORIGIN}/blog/qr-codes-made-easy`)
    await download('SVG')
    captures.push(await capture())

    // Wi-Fi with the Galaxy style.
    await popup.click('input[aria-label="Galaxy"]')
    await popup.click('input[aria-label^="Wi-Fi:"]')
    await setInput(popup, 'Studio Guest', 'input[placeholder="Home network"]')
    await setInput(popup, 'welcome-to-the-studio', 'input[placeholder="8 to 63 characters"]')
    await popup.click('button.generate-button')
    await popup.waitForSelector('.preview[data-status="ready"]')
    await download('PNG')
    captures.push(await capture())

    // Rounded blue code with a center logo, customization panels in view.
    const logo = join(ARTIFACTS, 'store-logo.png')
    mkdirSync(ARTIFACTS, { recursive: true })
    writeFileSync(
      logo,
      new Resvg(
        '<svg xmlns="http://www.w3.org/2000/svg" width="96" height="96"><rect width="96" height="96" rx="22" fill="#f97316"/><circle cx="48" cy="48" r="22" fill="none" stroke="#fff" stroke-width="9"/><circle cx="48" cy="48" r="7" fill="#fff"/></svg>',
      )
        .render()
        .asPng(),
    )
    await popup.click('input[aria-label^="URL:"]')
    await popup.click('button.generate-button')
    await popup.click('input[aria-label="Rounded"]')
    await popup.click('button[aria-label="Blue foreground"]')
    await (await popup.$('input[type="file"]'))!.uploadFile(logo)
    await popup.waitForSelector('.qr-graphic image')
    await popup.click('.toast-close')
    await download('PNG')
    await popup.$eval('.controls', (el) => el.scrollTo(0, 395))
    captures.push(await capture())

    // History after a contact download.
    await popup.$eval('.controls', (el) => el.scrollTo(0, 0))
    await popup.click('input[aria-label^="Contact:"]')
    await setInput(popup, 'Maya', 'input[autocomplete="given-name"]')
    await setInput(popup, 'Rodriguez', 'input[autocomplete="family-name"]')
    await setInput(popup, '+1 415 555 0172', '.content-form input[type="tel"]')
    await download('SVG')
    await popup.click('#tab-history')
    captures.push(await capture())

    // Light theme with the Neon style.
    await popup.click('#tab-generator')
    await popup.click('.logo-actions .is-danger')
    await popup.click('input[aria-label^="URL:"]')
    await popup.click('button.generate-button')
    await popup.click('input[aria-label="Neon"]')
    await popup.click('button[aria-label="Light theme"]')
    await popup.waitForSelector('.preview[data-status="ready"]')
    captures.push(await capture())

    for (const shot of captures) expect([pngToPixels(shot).width, pngToPixels(shot).height]).toEqual([800, 600])
  })

  it('composes the 1280×800 screenshots', async () => {
    const page = await h.browser.newPage()
    await page.setViewport({ width: 1280, height: 800 })
    for (const [index, shot] of SHOTS.entries()) {
      await page.setContent(`<!doctype html><style>${FONTS}
        * { box-sizing: border-box; margin: 0 }
        body { width: 1280px; height: 800px; overflow: hidden; ${BACKDROP} font-family: Geist, sans-serif; color: #f3f4fb; -webkit-font-smoothing: antialiased }
        .copy { position: absolute; left: 64px; top: 0; bottom: 0; width: 330px; display: flex; flex-direction: column; justify-content: center; gap: 18px }
        .brand { display: flex; align-items: center; gap: 10px; font-size: 22px; font-weight: 700; letter-spacing: -.02em }
        .brand b { font-weight: inherit } .brand span { background: linear-gradient(90deg, #a78bfa, #7c3aed 45%, #3b82f6); -webkit-background-clip: text; color: transparent }
        h1 { font-size: 40px; line-height: 1.12; font-weight: 700; letter-spacing: -.03em }
        p { font-size: 17px; line-height: 1.55; color: #a5a9c4 }
        .shot { position: absolute; left: 440px; top: 100px; width: 800px; height: 600px; border-radius: 16px; border: 1px solid rgb(255 255 255 / .12);
          box-shadow: 0 30px 80px -24px rgb(0 0 0 / .8), 0 0 120px -30px rgb(124 58 237 / .55); overflow: hidden }
        .shot img { display: block; width: 800px; height: 600px }
      </style>
      <div class="copy"><div class="brand">${MARK}<b>QR<span>Gen</span></b></div><h1>${shot.title}</h1><p>${shot.text}</p></div>
      <div class="shot"><img src="data:image/png;base64,${captures[index]!.toString('base64')}"></div>`)
      await page.evaluate(() => document.fonts.ready)
      await page.screenshot({ path: join(OUT, shot.file) })
    }
  })

  it('composes the 440×280 small promo tile', async () => {
    const result = buildQrCode('https://github.com/me-adityaraj8/qrgen', 'M')
    if (!result.ok) throw new Error(result.error)
    const qr = toSvgString(
      buildSvgSpec(result.qr.matrix, {
        style: 'galaxy',
        foreground: '#6d28d9',
        background: '#ffffff',
        gradient: true,
        gradientTo: '#2563eb',
        margin: 2,
        logo: null,
      }),
      { size: 150 },
    )
    const page = await h.browser.newPage()
    await page.setViewport({ width: 440, height: 280 })
    await page.setContent(`<!doctype html><style>${FONTS}
      * { box-sizing: border-box; margin: 0 }
      body { width: 440px; height: 280px; overflow: hidden; ${BACKDROP} font-family: Geist, sans-serif; color: #f3f4fb; -webkit-font-smoothing: antialiased }
      .copy { position: absolute; left: 30px; top: 0; bottom: 0; width: 210px; display: flex; flex-direction: column; justify-content: center; gap: 10px }
      .brand { display: flex; align-items: center; gap: 9px; font-size: 34px; font-weight: 700; letter-spacing: -.03em }
      .brand b { font-weight: inherit } .brand span { background: linear-gradient(90deg, #a78bfa, #7c3aed 45%, #3b82f6); -webkit-background-clip: text; color: transparent }
      p { font-size: 14.5px; line-height: 1.45; color: #a5a9c4 }
      .chip { align-self: flex-start; padding: 4px 10px; border-radius: 999px; border: 1px solid rgb(139 115 255 / .55); background: rgb(124 92 255 / .16); color: #c4b8ff; font-size: 12px; font-weight: 500 }
      .code { position: absolute; right: 30px; top: 50%; transform: translateY(-50%); width: 162px; height: 162px; padding: 6px; border-radius: 18px; background: #fff;
        box-shadow: 0 16px 40px -12px rgb(109 76 255 / .7) }
      .code svg { display: block; width: 150px; height: 150px }
    </style>
    <div class="copy"><div class="brand">${MARK.replace('width="34" height="34"', 'width="40" height="40"')}<b>QR<span>Gen</span></b></div>
      <p>QR codes for links, Wi-Fi, contacts and more.</p><span class="chip">Works offline</span></div>
    <div class="code">${qr}</div>`)
    await page.evaluate(() => document.fonts.ready)
    const tile = Buffer.from(await page.screenshot({ path: join(OUT, 'promo-small-440x280.png') }))
    // The code on the tile opens the repo; make sure it actually scans.
    expect(await decodePng(tile)).toEqual({ jsqr: 'https://github.com/me-adityaraj8/qrgen', zxing: 'https://github.com/me-adityaraj8/qrgen' })
  })
})
