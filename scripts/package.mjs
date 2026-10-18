// Zips dist/ into release/qr-code-generator-<version>.zip for the Chrome Web Store.
// Run via `npm run package` (which builds first).
import { createHash } from 'node:crypto'
import { existsSync, mkdirSync, readdirSync, readFileSync, statSync, writeFileSync } from 'node:fs'
import { join, relative, sep } from 'node:path'
import { fileURLToPath } from 'node:url'
import { zipSync } from 'fflate'

const root = fileURLToPath(new URL('..', import.meta.url))
const dist = join(root, 'dist')
const manifestPath = join(dist, 'manifest.json')

if (!existsSync(manifestPath)) {
  console.error('dist/manifest.json not found. Run `npm run build` first.')
  process.exit(1)
}

const manifest = JSON.parse(readFileSync(manifestPath, 'utf8'))
const files = {}
const walk = (dir) => {
  for (const entry of readdirSync(dir)) {
    const path = join(dir, entry)
    if (entry === '.DS_Store') continue
    if (statSync(path).isDirectory()) walk(path)
    else files[relative(dist, path).split(sep).join('/')] = readFileSync(path)
  }
}
walk(dist)

// manifest.json must sit at the root of the archive.
if (!files['manifest.json']) throw new Error('manifest.json missing from archive root')

const zip = zipSync(files, { level: 9, mtime: new Date('2026-01-01T00:00:00Z') })
const outDir = join(root, 'release')
mkdirSync(outDir, { recursive: true })
const outFile = join(outDir, `qr-code-generator-${manifest.version}.zip`)
writeFileSync(outFile, zip)

const sha256 = createHash('sha256').update(zip).digest('hex')
console.log(`Packaged ${Object.keys(files).length} files -> ${relative(root, outFile)}`)
console.log(`Size: ${(zip.length / 1024).toFixed(1)} KiB  SHA-256: ${sha256}`)
