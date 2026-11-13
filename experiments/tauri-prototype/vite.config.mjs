import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'
import { resolve, dirname } from 'node:path'
import { fileURLToPath } from 'node:url'
import { copyFileSync } from 'node:fs'

const root = dirname(fileURLToPath(import.meta.url))
export default defineConfig({
  root: resolve(root, 'renderer'),
  publicDir: false,
  resolve: { alias: { '@renderer': resolve(root, '../../src/renderer/src'), '@shared': resolve(root, '../../src/shared') } },
  plugins: [react(), tailwindcss(), {
    name: 'copy-reminder',
    closeBundle() {
      for (const name of ['reminder.html', 'reminder.js', 'reminder.css', 'handle.html', 'style.css']) copyFileSync(resolve(root, 'ui', name), resolve(root, 'renderer-dist', name))
    }
  }],
  build: { outDir: resolve(root, 'renderer-dist'), emptyOutDir: true }
})
