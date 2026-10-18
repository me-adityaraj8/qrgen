// Renders assets/icon.svg into the PNG sizes Chrome needs (public/icons/icon-N.png).
// The PNGs are committed; rerun this only after changing the SVG.
import { mkdirSync, readFileSync, writeFileSync } from 'node:fs'
import { Resvg } from '@resvg/resvg-js'

const svg = readFileSync(new URL('../assets/icon.svg', import.meta.url), 'utf8')
const outDir = new URL('../public/icons/', import.meta.url)
mkdirSync(outDir, { recursive: true })

for (const size of [16, 32, 48, 128]) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size }, font: { loadSystemFonts: false } }).render().asPng()
  writeFileSync(new URL(`icon-${size}.png`, outDir), png)
  console.log(`icons/icon-${size}.png  ${png.length} bytes`)
}
