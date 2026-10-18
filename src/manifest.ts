/**
 * Manifest V3 definition. Emitted as dist/manifest.json by the Vite build so the
 * version always matches package.json.
 *
 * Permissions are deliberately minimal:
 * - activeTab: read the URL of the tab the user opened the popup on. Granted only
 *   when the user clicks the toolbar icon or presses the shortcut, so no
 *   "read your browsing history" warning is shown at install.
 * - storage: remember colour / error-correction / size preferences locally.
 * - downloads: save PNG/SVG files with a proper filename and report failures.
 */
export function createManifest(version: string): chrome.runtime.ManifestV3 {
  return {
    manifest_version: 3,
    name: 'QRGen: QR Code Generator',
    short_name: 'QRGen',
    version,
    description:
      'QR codes for links, text, Wi-Fi, contacts, email and phone. Styles, colors and logos; PNG, SVG or clipboard. Works offline.',
    minimum_chrome_version: '116',
    icons: {
      16: 'icons/icon-16.png',
      32: 'icons/icon-32.png',
      48: 'icons/icon-48.png',
      128: 'icons/icon-128.png',
    },
    action: {
      default_title: 'Generate QR code',
      default_popup: 'popup.html',
      default_icon: {
        16: 'icons/icon-16.png',
        32: 'icons/icon-32.png',
      },
    },
    permissions: ['activeTab', 'storage', 'downloads'],
    commands: {
      _execute_action: {
        suggested_key: {
          default: 'Alt+Shift+Q',
          mac: 'Alt+Shift+Q',
        },
        description: 'Open QR Code Generator for the current tab',
      },
    },
  }
}
