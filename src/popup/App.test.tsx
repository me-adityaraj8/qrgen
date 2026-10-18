import { fireEvent, render, screen, waitFor, within } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'
import { copyImage, renderExport } from '../lib/export'
import { SETTINGS_STORAGE_KEY } from '../lib/chrome'
import { HISTORY_STORAGE_KEY } from '../lib/history'
import { LOGO_STORAGE_KEY } from '../lib/logo'
import { installChromeMock, uninstallChromeMock, type ChromeMockOptions } from '../test/chromeMock'
import { App } from './App'

// jsdom has no canvas, so PNG encoding and image copies are stubbed; SVG export runs for real.
vi.mock('../lib/export', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/export')>()
  return {
    ...actual,
    renderExport: vi.fn(async (...args: Parameters<typeof actual.renderExport>) =>
      args[3] === 'png' ? new Blob(['png'], { type: 'image/png' }) : actual.renderExport(...args),
    ),
    copyImage: vi.fn(async () => {}),
  }
})

// jsdom can't decode images; uploads resolve to a tiny PNG data URL.
const LOGO = 'data:image/png;base64,iVBORw0KGgo='
vi.mock('../lib/logo', async (importOriginal) => {
  const actual = await importOriginal<typeof import('../lib/logo')>()
  return { ...actual, readLogoFile: vi.fn(async () => LOGO) }
})

const TAB_URL = 'https://example.com/docs/intro?lang=en&v=2'
const blobs: Blob[] = []

beforeEach(() => {
  localStorage.clear()
  delete document.documentElement.dataset.theme
  blobs.length = 0
  URL.createObjectURL = vi.fn((blob: Blob) => {
    blobs.push(blob)
    return `blob:test/${blobs.length}`
  })
  URL.revokeObjectURL = vi.fn()
})

afterEach(() => uninstallChromeMock())

async function setup(options: ChromeMockOptions = { tabUrl: TAB_URL }) {
  const mock = installChromeMock(options)
  const user = userEvent.setup()
  render(<App />)
  const input = await screen.findByRole('textbox', { name: 'Website URL' })
  return { ...mock, user, input }
}

const qrImage = (name: RegExp | string = /^QR code for /) => screen.findByRole('img', { name })
const generate = () => screen.getByRole('button', { name: 'Generate' })
const status = () => document.querySelector('.preview .status')!
const downloadButton = (format: 'PNG' | 'SVG') => screen.getByRole('button', { name: new RegExp(`^Download ${format}`) })
const toast = (text: string | RegExp) => within(document.querySelector('.toast-region') as HTMLElement).findByText(text)
const stat = (term: string) => screen.getByText(term, { selector: 'dt' }).parentElement!
/** The settings menu is a native popover; open it before using its controls. */
async function openSettings(user: ReturnType<typeof userEvent.setup>) {
  await user.click(screen.getByRole('button', { name: 'Settings' }))
  const menu = document.querySelector<HTMLElement>('[popover]')!
  // jsdom hides [popover] but can't open one; real Chrome is covered by the E2E suite.
  if (typeof menu.showPopover !== 'function') menu.removeAttribute('popover')
  return within(menu)
}
const chooseType = (user: ReturnType<typeof userEvent.setup>, name: string) =>
  user.click(screen.getByRole('radio', { name: new RegExp(`^${name}:`) }))

describe('current tab', () => {
  it('prefills the tab URL and generates its QR code on open', async () => {
    const { input } = await setup()
    expect(input).toHaveValue(TAB_URL)
    expect(await qrImage()).toHaveAccessibleName(`QR code for ${TAB_URL}`)
    expect(status()).toHaveTextContent('QR Code Ready')
    expect(stat('Version')).toHaveTextContent('Version329 × 29 modules')
    expect(stat('Error correction')).toHaveTextContent('Level M')
    expect(stat('Data size')).toHaveTextContent(`${TAB_URL.length} bytes`)
    expect(screen.getByRole('button', { name: 'Current tab' })).toBeDisabled()
    expect(input).toHaveFocus()
  })

  it('explains browser pages that cannot be encoded', async () => {
    const { input } = await setup({ tabUrl: 'chrome://extensions/' })
    expect(input).toHaveValue('')
    expect(screen.getByText(/Browser pages like this one/)).toBeInTheDocument()
    expect(screen.getByText('Your QR code will appear here')).toBeInTheDocument()
    expect(status()).toHaveTextContent('Waiting for content')
    expect(downloadButton('PNG')).toBeDisabled()
  })

  it('works without a readable tab URL', async () => {
    await setup({ tabUrl: undefined })
    expect(screen.getByText(/address isn't available to extensions/)).toBeInTheDocument()
    expect(screen.queryByRole('button', { name: /current tab/i })).not.toBeInTheDocument()
  })
})

describe('URL input', () => {
  it.each([
    ['', 'Enter a URL to generate a QR code.'],
    ['not a url', /can't contain spaces/],
    ['javascript:alert(1)', /Only http:\/\/ and https:\/\//],
    ['example', /Add a domain ending/],
  ])('rejects %j', async (value, message) => {
    const { user, input } = await setup({ tabUrl: undefined })
    if (value) await user.type(input, value)
    await user.click(generate())
    expect(await screen.findByRole('alert')).toHaveTextContent(message)
    expect(input).toHaveAttribute('aria-invalid', 'true')
  })

  it('generates from typed input with Enter and normalizes it', async () => {
    const { user, input } = await setup()
    await user.click(screen.getByRole('button', { name: 'Clear URL' }))
    expect(input).toHaveValue('')
    await user.type(input, 'shop.example.org/cart?item=1&qty=2{Enter}')
    expect(await qrImage()).toHaveAccessibleName('QR code for https://shop.example.org/cart?item=1&qty=2')
  })

  it('marks the preview out of date after editing and regenerates on Generate', async () => {
    const { user, input } = await setup()
    await qrImage()
    await user.type(input, '&page=3')
    expect(screen.getByText('Press Generate to update')).toBeInTheDocument()
    expect(status()).toHaveTextContent('Out of date')
    await user.click(generate())
    expect(screen.queryByText('Press Generate to update')).not.toBeInTheDocument()
    expect(await qrImage()).toHaveAccessibleName(`QR code for ${TAB_URL}&page=3`)
  })

  it('restores the current tab URL', async () => {
    const { user, input } = await setup()
    await user.clear(input)
    await user.type(input, 'example.net{Enter}')
    await user.click(screen.getByRole('button', { name: 'Use current tab' }))
    expect(input).toHaveValue(TAB_URL)
    expect(await qrImage()).toHaveAccessibleName(`QR code for ${TAB_URL}`)
  })

  it('reports content too long for the chosen error-correction level', async () => {
    const long = `https://example.com/?q=${'x'.repeat(1500)}`
    const { user } = await setup({ tabUrl: long })
    expect(screen.getByText('1,523 / 2,331 bytes')).toBeInTheDocument()
    await user.click(screen.getByRole('radio', { name: 'H, High' }))
    expect(await screen.findByText(/too long for a QR code at level H/)).toBeInTheDocument()
    expect(status()).toHaveTextContent("Can't generate")
    expect(downloadButton('PNG')).toBeDisabled()
    await user.click(screen.getByRole('radio', { name: 'L, Low' }))
    expect(await qrImage()).toHaveAccessibleName(`QR code for ${long}`)
  })
})

describe('QR types', () => {
  it('encodes Wi-Fi and masks the password on screen', async () => {
    const { user } = await setup()
    await chooseType(user, 'Wi-Fi')
    await user.type(screen.getByRole('textbox', { name: 'Network name (SSID)' }), 'Studio 5G')
    const password = screen.getByLabelText('Password')
    await user.type(password, 'short{Enter}')
    expect(await screen.findByRole('alert')).toHaveTextContent('WPA passwords are 8 to 63 characters.')
    await user.type(password, '-but-long-enough{Enter}')
    expect(await qrImage('QR code for Wi-Fi · Studio 5G')).toBeInTheDocument()
    expect(document.querySelector('.encoded-text')).toHaveTextContent('WIFI:T:WPA;S:Studio 5G;P:••••••••;;')
    await user.click(screen.getByRole('button', { name: 'Show password' }))
    expect(password).toHaveAttribute('type', 'text')
  })

  it('encodes a contact as a vCard', async () => {
    const { user } = await setup()
    await chooseType(user, 'Contact')
    await user.type(screen.getByRole('textbox', { name: 'First name' }), 'Ada')
    await user.click(generate())
    expect(await screen.findByRole('alert')).toHaveTextContent('Add a phone number or an email address.')
    await user.type(screen.getByRole('textbox', { name: 'Email' }), 'ada@example.com{Enter}')
    expect(await qrImage('QR code for Ada')).toBeInTheDocument()
    expect(document.querySelector('.encoded-text')).toHaveTextContent('BEGIN:VCARD')
  })

  it.each([
    ['Email', 'To', 'team@example.com', 'mailto:team@example.com'],
    ['Phone', 'Phone number', '+1 555 010 9999', 'tel:+15550109999'],
  ])('encodes %s', async (type, field, value, expected) => {
    const { user } = await setup()
    await chooseType(user, type)
    await user.type(screen.getByRole('textbox', { name: field }), `${value}{Enter}`)
    await qrImage()
    expect(document.querySelector('.encoded-text')).toHaveTextContent(expected)
  })

  it('encodes multi-line text with Cmd/Ctrl+Enter', async () => {
    const { user } = await setup()
    await chooseType(user, 'Text')
    const text = screen.getByRole('textbox', { name: 'Text' })
    await user.type(text, 'Line one{Shift>}{Enter}{/Shift}Line two')
    await user.keyboard('{Control>}{Enter}{/Control}')
    expect(await qrImage('QR code for Line one')).toBeInTheDocument()
  })
})

describe('customization', () => {
  it('applies a style with its palette and saves settings', async () => {
    const { user, storage } = await setup()
    const image = await qrImage()
    await user.click(screen.getByRole('radio', { name: 'Galaxy' }))
    expect(screen.getByRole('textbox', { name: 'Gradient start' })).toHaveValue('#6d28d9')
    expect(screen.getByRole('textbox', { name: 'Gradient end' })).toHaveValue('#2563eb')
    expect(image.outerHTML).toContain('<linearGradient')
    await waitFor(() => expect(storage[SETTINGS_STORAGE_KEY]).toMatchObject({ style: 'galaxy', gradient: true }))
  })

  it('sets the foreground from swatches and toggles the gradient', async () => {
    const { user } = await setup()
    const image = await qrImage()
    await user.click(screen.getByRole('button', { name: 'Pink foreground' }))
    expect(screen.getByRole('button', { name: 'Pink foreground' })).toHaveAttribute('aria-pressed', 'true')
    expect(image.outerHTML).toContain('fill="#be185d"')
    await user.click(screen.getByRole('switch', { name: 'Gradient' }))
    expect(screen.getByRole('textbox', { name: 'Gradient end' })).toBeInTheDocument()
  })

  it('changes error correction, size and margin', async () => {
    const { user } = await setup()
    await qrImage()
    await user.click(screen.getByRole('radio', { name: 'Q, Quartile' }))
    expect(stat('Error correction')).toHaveTextContent('Level Q')
    fireEvent.change(screen.getByRole('slider', { name: 'Export size' }), { target: { value: '3' } })
    expect(downloadButton('PNG')).toHaveAccessibleName('Download PNG, 2048 px')
    fireEvent.change(screen.getByRole('slider', { name: 'Margin' }), { target: { value: '8' } })
    const size = Number(stat('Version').querySelector('.stat-sub')!.textContent!.match(/^(\d+) ×/)![1])
    expect((await qrImage()).getAttribute('viewBox')).toBe(`0 0 ${size + 16} ${size + 16}`)
  })

  it('blocks downloads when contrast is too low', async () => {
    const { user } = await setup()
    await qrImage()
    const foreground = screen.getByRole('textbox', { name: 'Foreground' })
    await user.clear(foreground)
    await user.type(foreground, '#dddddd')
    expect(screen.getByRole('alert')).toHaveTextContent(/Contrast is 1\.\d:1/)
    expect(status()).toHaveTextContent('Low contrast')
    expect(downloadButton('PNG')).toBeDisabled()
    expect(screen.getByRole('button', { name: 'Copy to clipboard' })).toBeDisabled()
  })

  it('adds a logo, raises error correction and removes it', async () => {
    const { user, storage } = await setup()
    const image = await qrImage()
    await user.upload(screen.getByLabelText('Logo file'), new File(['png'], 'logo.png', { type: 'image/png' }))
    expect(await toast('Error correction set to H so the code still scans with a logo.')).toBeInTheDocument()
    expect(stat('Error correction')).toHaveTextContent('Level H')
    await waitFor(() => expect((document.querySelector('.qr-graphic image') as Element).getAttribute('href')).toBe(LOGO))
    await waitFor(() => expect(storage[LOGO_STORAGE_KEY]).toBe(LOGO))
    await user.click(screen.getByRole('button', { name: 'Remove' }))
    expect(image.ownerDocument.querySelector('.qr-graphic image')).toBeNull()
  })

  it('loads saved settings and resets to defaults', async () => {
    const { user } = await setup({
      tabUrl: TAB_URL,
      stored: { [SETTINGS_STORAGE_KEY]: { style: 'dots', foreground: '#112233', errorCorrection: 'H', size: 512, margin: 6 } },
    })
    await qrImage()
    expect(screen.getByRole('radio', { name: 'Dots' })).toBeChecked()
    expect(screen.getByRole('textbox', { name: 'Foreground' })).toHaveValue('#112233')
    await user.click(screen.getByRole('button', { name: 'Reset to defaults' }))
    expect(screen.getByRole('radio', { name: 'Classic' })).toBeChecked()
    expect(screen.getByRole('textbox', { name: 'Foreground' })).toHaveValue('#000000')
    expect(stat('Error correction')).toHaveTextContent('Level M')
    expect(screen.getByRole('button', { name: 'Reset to defaults' })).toBeDisabled()
  })
})

describe('export', () => {
  it('downloads an SVG that encodes the previewed content', async () => {
    const { user, chrome } = await setup()
    await qrImage()
    await user.click(downloadButton('SVG'))
    expect(await toast('Saved qr-example.com-docs-intro.svg')).toBeInTheDocument()
    expect(chrome.downloads.download).toHaveBeenCalledWith({
      url: 'blob:test/1',
      filename: 'qr-example.com-docs-intro.svg',
      conflictAction: 'uniquify',
    })
    const svg = await blobs[0]!.text()
    expect(svg).toContain(`<title>QR code: ${TAB_URL.replace('&', '&amp;')}</title>`)
    expect(svg).toContain('width="1024" height="1024"')
  })

  it('downloads a PNG using the current settings', async () => {
    const { user } = await setup()
    await qrImage()
    await user.click(screen.getByRole('radio', { name: 'H, High' }))
    await user.click(screen.getByRole('radio', { name: 'Rounded' }))
    await user.click(downloadButton('PNG'))
    expect(await toast('Saved qr-example.com-docs-intro.png')).toBeInTheDocument()
    const [qr, design, size, format] = vi.mocked(renderExport).mock.calls.at(-1)!
    expect([qr.text, qr.matrix.errorCorrection, design.style, size, format]).toEqual([TAB_URL, 'H', 'rounded', 1024, 'png'])
  })

  it('uses the latest input when downloading without pressing Generate', async () => {
    const { user, input } = await setup()
    await qrImage()
    await user.clear(input)
    await user.type(input, 'https://example.org/new')
    await user.click(downloadButton('SVG'))
    expect(await toast('Saved qr-example.org-new.svg')).toBeInTheDocument()
    expect(await qrImage()).toHaveAccessibleName('QR code for https://example.org/new')
  })

  it('names other types after their content', async () => {
    const { user } = await setup()
    await chooseType(user, 'Phone')
    await user.type(screen.getByRole('textbox', { name: 'Phone number' }), '+44 20 7946 0958')
    await user.click(downloadButton('SVG'))
    expect(await toast('Saved qr-phone-442079460958.svg')).toBeInTheDocument()
  })

  it('does not download invalid edited input', async () => {
    const { user, input, chrome } = await setup()
    await qrImage()
    await user.clear(input)
    await user.type(input, 'bad url')
    await user.click(downloadButton('PNG'))
    expect(await screen.findByRole('alert')).toHaveTextContent(/can't contain spaces/)
    expect(chrome.downloads.download).not.toHaveBeenCalled()
  })

  it('reports rejected and interrupted downloads', async () => {
    const { user, chrome, interruptNextDownload } = await setup()
    await qrImage()
    chrome.downloads.download.mockRejectedValueOnce(new Error('Invalid filename'))
    await user.click(downloadButton('PNG'))
    expect(await toast('Download failed: Invalid filename.')).toBeInTheDocument()
    interruptNextDownload('FILE_NO_SPACE')
    await user.click(downloadButton('SVG'))
    expect(await toast('Download failed: not enough disk space.')).toBeInTheDocument()
  })

  it('copies the image and the encoded content', async () => {
    const { user } = await setup()
    await qrImage()
    await user.click(screen.getByRole('button', { name: 'Copy to clipboard' }))
    expect(await toast('QR image copied to the clipboard')).toBeInTheDocument()
    expect(vi.mocked(copyImage)).toHaveBeenCalledTimes(1)
    await user.click(screen.getByRole('button', { name: 'Copy encoded content' }))
    expect(await navigator.clipboard.readText()).toBe(TAB_URL)
  })
})

describe('history', () => {
  it('records downloads, restores and deletes entries', async () => {
    const { user, input, storage } = await setup()
    await qrImage()
    await user.click(downloadButton('SVG'))
    await toast(/^Saved/)
    await waitFor(() => expect(storage[HISTORY_STORAGE_KEY]).toHaveLength(1))
    expect(screen.getByRole('tab', { name: /History/ })).toHaveTextContent('1')

    await user.clear(input)
    await user.type(input, 'example.net{Enter}')
    await user.click(screen.getByRole('tab', { name: /History/ }))
    const panel = screen.getByRole('tabpanel', { name: /History/ })
    await user.click(within(panel).getByRole('button', { name: `Open ${TAB_URL}` }))
    expect(screen.getByRole('tab', { name: 'Generator' })).toHaveAttribute('aria-selected', 'true')
    expect(input).toHaveValue(TAB_URL)

    await user.click(screen.getByRole('tab', { name: /History/ }))
    await user.click(within(panel).getByRole('button', { name: `Delete ${TAB_URL}` }))
    expect(within(panel).getByText('No saved codes yet')).toBeInTheDocument()
  })

  it('asks for the Wi-Fi password again when restoring', async () => {
    const { user } = await setup()
    await chooseType(user, 'Wi-Fi')
    await user.type(screen.getByRole('textbox', { name: 'Network name (SSID)' }), 'Home')
    await user.type(screen.getByLabelText('Password'), 'super-secret-1')
    await user.click(downloadButton('SVG'))
    await toast(/^Saved/)
    await user.click(screen.getByRole('tab', { name: /History/ }))
    expect(screen.getByText('Password not saved')).toBeInTheDocument()
    await user.click(screen.getByRole('button', { name: 'Open Wi-Fi · Home' }))
    expect(await screen.findByRole('alert')).toHaveTextContent('Re-enter the Wi-Fi password')
    expect(screen.getByLabelText('Password')).toHaveValue('')
  })

  it('does not record when history is off', async () => {
    const { user, storage } = await setup()
    await qrImage()
    const menu = await openSettings(user)
    await user.click(menu.getByRole('switch', { name: 'Save history' }))
    await user.click(downloadButton('SVG'))
    await toast(/^Saved/)
    expect(storage[HISTORY_STORAGE_KEY]).toBeUndefined()
  })
})

describe('header', () => {
  it('switches theme and remembers it', async () => {
    const { user } = await setup()
    await waitFor(() => expect(document.documentElement.dataset.theme).toBe('dark'))
    await user.click(screen.getByRole('button', { name: 'Light theme' }))
    expect(document.documentElement.dataset.theme).toBe('light')
    expect(screen.getByRole('button', { name: 'Light theme' })).toHaveAttribute('aria-pressed', 'true')
    expect(localStorage.getItem('qr-theme')).toBe('light')
  })

  it('moves between tabs with the arrow keys', async () => {
    const { user } = await setup()
    await qrImage()
    screen.getByRole('tab', { name: 'Generator' }).focus()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: /History/ })).toHaveFocus()
    expect(screen.getByRole('tabpanel', { name: /History/ })).toBeVisible()
    await user.keyboard('{ArrowRight}')
    expect(screen.getByRole('tab', { name: 'About' })).toHaveAttribute('aria-selected', 'true')
    expect(screen.getByText(/version 1\.0\.0/)).toBeInTheDocument()
  })

  it('opens Chrome shortcut settings from the settings menu', async () => {
    const { user, chrome } = await setup()
    await qrImage()
    const menu = await openSettings(user)
    await user.click(await menu.findByRole('button', { name: /Keyboard shortcut/ }))
    expect(chrome.tabs.create).toHaveBeenCalledWith({ url: 'chrome://extensions/shortcuts' })
  })
})
