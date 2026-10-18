import { existsSync, mkdirSync, readdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs'
import { createServer, type Server } from 'node:http'
import type { AddressInfo } from 'node:net'
import { join, resolve } from 'node:path'
import puppeteer, { type Browser, type Extension, type Page } from 'puppeteer'

export const ROOT = resolve(import.meta.dirname, '../..')
export const DIST = join(ROOT, 'dist')
export const ARTIFACTS = join(ROOT, '.e2e-artifacts')

export interface Harness {
  browser: Browser
  extension: Extension
  baseUrl: string
  downloadDir: string
  /** Console errors and uncaught exceptions from every popup opened. */
  popupErrors: string[]
  close: () => Promise<void>
}

/** Serves a plain page for any path, so tabs can have arbitrary URLs. */
function startServer(): Promise<Server> {
  const server = createServer((request, response) => {
    response.writeHead(200, { 'content-type': 'text/html; charset=utf-8' })
    response.end(`<!doctype html><title>Fixture</title><h1>Fixture page</h1><p>${request.url?.length ?? 0} chars</p>`)
  })
  return new Promise((resolveServer) => server.listen(0, '127.0.0.1', () => resolveServer(server)))
}

export async function launch(): Promise<Harness> {
  if (!existsSync(join(DIST, 'manifest.json'))) {
    throw new Error('dist/ is missing. Run `npm run build` first (npm run test:e2e does this).')
  }
  const runDir = join(ARTIFACTS, `run-${Date.now()}`)
  const profileDir = join(runDir, 'profile')
  const downloadDir = join(runDir, 'downloads')
  mkdirSync(join(profileDir, 'Default'), { recursive: true })
  mkdirSync(downloadDir, { recursive: true })
  // Fresh profile that saves downloads to a known folder without prompting.
  writeFileSync(
    join(profileDir, 'Default', 'Preferences'),
    JSON.stringify({
      download: { default_directory: downloadDir, prompt_for_download: false, directory_upgrade: true },
      savefile: { default_directory: downloadDir },
    }),
  )

  const server = await startServer()
  const baseUrl = `http://127.0.0.1:${(server.address() as AddressInfo).port}`
  const browser = await puppeteer.launch({
    // HEADFUL=1 shows the browser, e.g. to check real popup sizing.
    headless: process.env.HEADFUL !== '1',
    pipe: true,
    enableExtensions: true,
    userDataDir: profileDir,
    args: ['--no-first-run', '--no-default-browser-check'],
  })
  const id = await browser.installExtension(DIST)
  const extension = (await browser.extensions()).get(id)
  if (!extension) throw new Error('Extension did not install')

  return {
    browser,
    extension,
    baseUrl,
    downloadDir,
    popupErrors: [],
    close: async () => {
      await browser.close()
      await new Promise((done) => server.close(done))
      rmSync(profileDir, { recursive: true, force: true })
    },
  }
}

/** Opens a tab at `url` and clicks the extension's toolbar button, like a user would. */
export async function openPopupFor(harness: Harness, url: string): Promise<{ tab: Page; popup: Page }> {
  const tab = await harness.browser.newPage()
  await tab.goto(url, { waitUntil: 'load' })
  await tab.bringToFront()
  const popupUrl = `chrome-extension://${harness.extension.id}/popup.html`
  const target = harness.browser.waitForTarget((t) => t.url().startsWith(popupUrl), { timeout: 10_000 })
  await tab.triggerExtensionAction(harness.extension)
  const popup = await (await target).asPage()
  popup.on('console', (message) => {
    if (message.type() === 'error') harness.popupErrors.push(message.text())
  })
  popup.on('pageerror', (error) => harness.popupErrors.push(String(error)))
  await popup.waitForSelector('.app')
  return { tab, popup }
}

/** Replaces the URL field's text the way a paste would. */
export async function setInput(popup: Page, value: string, selector = '.command-input') {
  await popup.focus(selector)
  await popup.$eval(selector, (el) => (el as HTMLInputElement | HTMLTextAreaElement).select())
  await popup.keyboard.press('Backspace')
  if (value) await popup.keyboard.sendCharacter(value)
}

export async function waitForDownload(dir: string, name: string, timeout = 15_000): Promise<Buffer> {
  const deadline = Date.now() + timeout
  while (Date.now() < deadline) {
    const files = readdirSync(dir)
    if (files.includes(name) && !files.some((file) => file.endsWith('.crdownload'))) {
      return readFileSync(join(dir, name))
    }
    await new Promise((done) => setTimeout(done, 100))
  }
  throw new Error(`Timed out waiting for ${name}; found: ${readdirSync(dir).join(', ') || 'nothing'}`)
}
