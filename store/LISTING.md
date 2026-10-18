# Chrome Web Store listing

Everything to paste into the [Developer Dashboard](https://chrome.google.com/webstore/devconsole), tab by tab. Upload `release/qr-code-generator-<version>.zip` first (`npm run package`). The name, summary and icon come from the zip.

## Package (from the zip)

- **Name:** QRGen: QR Code Generator
- **Summary (132 characters max):** QR codes for links, text, Wi-Fi, contacts, email and phone. Styles, colors and logos; PNG, SVG or clipboard. Works offline.

## Store listing tab

**Description:**

```
QRGen makes QR codes for the page you're on, or for anything you type. Click the toolbar icon (or press Alt+Shift+Q) and the code for the current tab is ready.

WHAT YOU CAN ENCODE
• Links, including the current tab in one click
• Wi-Fi networks (WPA, WEP or open), so guests can join by scanning
• Contacts, saved as a vCard
• Emails with a subject and message
• Phone numbers
• Plain text

MAKE IT YOURS
• Six styles: Classic, Rounded, Dots, Galaxy, Neon and Minimal
• Any colors, quick swatches and two-color gradients
• Your logo in the center
• Error correction L, M, Q or H, and a margin from 4 to 16 modules
• Styled codes keep the patterns scanners rely on, and colors with too little contrast are blocked

EXPORT
• Download PNG (256 to 2048 px) or SVG
• Copy the image straight to the clipboard
• Files are named after what they contain

PRIVATE BY DESIGN
• Works offline: no account, no ads, no analytics, no network requests
• A history of codes you download or copy stays on your device, and you can turn it off
• Wi-Fi passwords are never saved

Also: light and dark themes, and full keyboard support.

Open source: https://github.com/me-adityaraj8/qrgen
```

- **Category:** Productivity (subcategory Tools, if offered)
- **Language:** English
- **Store icon:** already in the zip (128×128)
- **Screenshots (1280×800, upload in this order):**
  1. `store/screenshot-1-generator.png`
  2. `store/screenshot-2-wifi.png`
  3. `store/screenshot-3-style.png`
  4. `store/screenshot-4-history.png`
  5. `store/screenshot-5-light.png`
- **Small promo tile (440×280):** `store/promo-small-440x280.png`
- **Marquee promo tile:** optional, skip
- **Official URL / Homepage:** https://github.com/me-adityaraj8/qrgen
- **Support URL:** https://github.com/me-adityaraj8/qrgen/issues

## Privacy tab

**Single purpose:**

```
Create QR codes on the user's device for the current tab's URL or for content the user enters (text, Wi-Fi details, a contact, an email or a phone number), and export them as PNG, SVG or a copied image.
```

**Permission justifications:**

`activeTab`
```
When the user clicks the toolbar icon or presses the shortcut, the extension reads the URL of that tab to pre-fill the URL field, so a QR code for the current page is ready right away. It does not read page content or any other tab.
```

`storage`
```
Saves the user's style settings, an optional logo image and a local history of codes they downloaded or copied, in chrome.storage.local on the device. Nothing is synced or sent anywhere.
```

`downloads`
```
Saves the PNG or SVG file the user asks for under a descriptive filename, and reports failed or canceled downloads in the popup.
```

**Remote code:** No, I am not using remote code.

**Data usage:**

- Tick **Web history**. The extension reads the current tab's URL when it's opened, and History keeps the URLs of codes the user saved. Both stay on the device, but Chrome's policy asks for local handling to be disclosed too.
- Leave every other data type unticked.
- Tick all three certifications:
  - I do not sell or transfer user data to third parties, outside of the approved use cases.
  - I do not use or transfer user data for purposes that are unrelated to my item's single purpose.
  - I do not use or transfer user data to determine creditworthiness or for lending purposes.

**Privacy policy URL:** https://github.com/me-adityaraj8/qrgen/blob/main/PRIVACY.md

## Distribution tab

- **Visibility:** Public
- **Regions:** All regions
- **Pricing:** Free

## Test instructions (if asked)

```
No account or setup is needed. Open any web page and click the QRGen toolbar icon: a QR code for that page appears. Use the type tiles at the top for Wi-Fi, contact, email, phone or text, and the Customize section for styles, colors and a logo.
```

## Updating later

Bump `version` in `package.json`, run `npm run package`, then upload the new zip under Package → Upload new package. Run `npm run store-assets` to regenerate these images if the UI changes.
