import { Download, HardDrive, Keyboard, Palette, ShieldCheck, Sparkles } from 'lucide-react'
import { BrandMark } from '../components/BrandMark'
import { extensionVersion, openShortcutSettings } from '../lib/chrome'

const FACTS = [
  { icon: HardDrive, title: 'Made on your device', text: 'Codes are generated inside the extension. Nothing you enter is uploaded or tracked.' },
  { icon: Sparkles, title: 'Six content types', text: 'Links, text, Wi-Fi networks, contacts (vCard), email and phone numbers.' },
  { icon: Palette, title: 'Styles that still scan', text: 'Finder and alignment patterns stay solid and the quiet zone never drops below 4 modules.' },
  { icon: Download, title: 'PNG, SVG or clipboard', text: 'Exports use exactly what the preview shows, at 256 to 2048 px.' },
]

export function AboutView({ shortcut }: { shortcut: string | null }) {
  const version = extensionVersion()
  return (
    <section className="page" aria-labelledby="about-title">
      <div className="about-hero">
        <BrandMark size={44} />
        <div>
          <h2 id="about-title" className="page-title">
            QR<span className="brand-accent">Gen</span>
          </h2>
          <p className="page-subtitle">QR Code Generator for Chrome{version ? ` · version ${version}` : ''}</p>
        </div>
      </div>

      <ul className="facts">
        {FACTS.map(({ icon: Icon, title, text }) => (
          <li key={title} className="fact">
            <span className="stat-icon" aria-hidden="true">
              <Icon size={16} strokeWidth={1.8} />
            </span>
            <div>
              <p className="fact-title">{title}</p>
              <p className="fact-text">{text}</p>
            </div>
          </li>
        ))}
      </ul>

      <div className="about-row">
        <div className="about-block">
          <p className="about-label">
            <Keyboard size={14} strokeWidth={1.8} /> Shortcuts
          </p>
          <p className="fact-text">
            Open the popup: <kbd>{shortcut || 'not set'}</kbd>{' '}
            {shortcut !== null && (
              <button type="button" className="inline-link" onClick={openShortcutSettings}>
                Change
              </button>
            )}
            <br />
            Generate: <kbd>Enter</kbd> (<kbd>⌘/Ctrl + Enter</kbd> in multi-line fields)
          </p>
        </div>
        <div className="about-block">
          <p className="about-label">
            <ShieldCheck size={14} strokeWidth={1.8} /> Permissions
          </p>
          <p className="fact-text">
            Active tab (read the page you open it on), storage (your settings and history) and downloads (save files).
          </p>
        </div>
      </div>

      <p className="credits">
        Built with qrcode (MIT), Lucide icons (ISC) and the Geist typeface (OFL-1.1). The extension does not check whether a
        destination is safe to visit.
      </p>
    </section>
  )
}
