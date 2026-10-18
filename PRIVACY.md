# Privacy policy

**QRGen: QR Code Generator** (the "extension")
Last updated: October 18, 2026

QRGen makes QR codes inside your browser. It has no servers, no accounts, no analytics and no ads, and it never sends anything you enter or anything about your browsing over the network.

## What the extension accesses

- **The address of the current tab.** When you click the toolbar icon or use the keyboard shortcut, Chrome lets the extension read the URL of that one tab (the `activeTab` permission). It is used only to fill in the URL field so you can make a QR code for the page. The extension can't see other tabs, page content or your browsing history.
- **What you type or upload.** URLs, text, Wi-Fi details, contact details, email and phone fields, and an optional logo image. These are used only to build the QR code you asked for.

## What is stored, and where

Everything stays in your browser's local extension storage on your own device:

- **Settings:** style, colors, error correction, size and margin, and your light/dark theme choice.
- **Logo:** the image you uploaded, until you remove it.
- **History:** codes you download or copy (their content and style), so you can reopen them later. Wi-Fi passwords are never saved: they're removed before an entry is stored. History can be turned off in Settings.

You can delete this data at any time with **Settings → Clear history** or **Settings → Reset all settings**. Removing the extension deletes all of it.

## What is shared

Nothing. The extension does not transmit, sell, rent or share any data with anyone, and it does not use data for advertising, credit decisions or any purpose other than making QR codes.

## Permissions

| Permission | Why it's needed |
| --- | --- |
| `activeTab` | Read the URL of the tab you opened the extension on. |
| `storage` | Keep your settings, logo and history on your device. |
| `downloads` | Save the PNG or SVG files you ask to download. |

## Links you encode

QR codes contain whatever you put in them. The extension doesn't check whether a link or other destination is safe to visit.

## Changes

If this policy changes, the new version will be published here with a new date. If the extension ever starts handling data differently, you'll be told in the extension before it happens.

## Contact

Questions or concerns: open an issue at https://github.com/me-adityaraj8/qrgen/issues
