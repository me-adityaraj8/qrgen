import { readFileSync } from 'node:fs'
import { resolve } from 'node:path'
import { defineConfig, type Plugin } from 'vite'
import react from '@vitejs/plugin-react'
import { createManifest } from './src/manifest.ts'

const pkg = JSON.parse(readFileSync(new URL('./package.json', import.meta.url), 'utf8')) as {
  version: string
}

/** Writes manifest.json into the build output. */
function extensionManifest(): Plugin {
  return {
    name: 'extension-manifest',
    apply: 'build',
    generateBundle() {
      this.emitFile({
        type: 'asset',
        fileName: 'manifest.json',
        source: `${JSON.stringify(createManifest(pkg.version), null, 2)}\n`,
      })
    },
  }
}

/** Dev server only: serve the popup at "/" (the extension has no index.html). */
function popupAtRoot(): Plugin {
  return {
    name: 'popup-at-root',
    apply: 'serve',
    configureServer(server) {
      server.middlewares.use((request, _response, next) => {
        if (request.url === '/' || request.url?.startsWith('/?')) request.url = `/popup.html${request.url.slice(1)}`
        next()
      })
    },
  }
}

export default defineConfig({
  // Relative asset URLs so popup.html works from chrome-extension://<id>/.
  base: './',
  plugins: [react(), extensionManifest(), popupAtRoot()],
  // Inline PostCSS config stops Vite from picking up configs in parent folders.
  css: { postcss: {} },
  server: { port: 5175, strictPort: true },
  build: {
    outDir: 'dist',
    emptyOutDir: true,
    target: 'chrome116',
    // Extension pages are local; the preload polyfill is unnecessary.
    modulePreload: { polyfill: false },
    sourcemap: false,
    rollupOptions: {
      input: { popup: resolve(import.meta.dirname, 'popup.html') },
    },
  },
})
