import { defineConfig } from 'vite'
import { readFileSync } from 'node:fs'
import { resolve, dirname } from 'node:path'

/**
 * Plugin minimale per includere parziali HTML a build time.
 * Uso dentro index.html:  <!-- @include src/sections/hero.html -->
 * Gli include sono ricorsivi (un parziale puo' includerne altri).
 */
function htmlInclude() {
  const root = process.cwd()
  const expand = (html, fromDir, depth = 0) => {
    if (depth > 10) return html
    return html.replace(/<!--\s*@include\s+([^\s]+)\s*-->/g, (_m, file) => {
      const full = resolve(root, file)
      const content = readFileSync(full, 'utf-8')
      return expand(content, dirname(full), depth + 1)
    })
  }
  return {
    name: 'lab21-html-include',
    enforce: 'pre',
    transformIndexHtml: {
      order: 'pre',
      handler: (html) => expand(html, root)
    },
    // in dev: ricarica la pagina quando cambia un parziale
    handleHotUpdate({ file, server }) {
      if (file.includes('/src/sections/') || file.includes('/src/i18n/')) {
        server.ws.send({ type: 'full-reload' })
      }
    }
  }
}

export default defineConfig({
  plugins: [htmlInclude()],
  server: { port: 5173, open: true },
  preview: { port: 4173 },
  build: { outDir: 'dist', assetsDir: 'assets', emptyOutDir: true }
})
