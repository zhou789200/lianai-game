import { build } from 'vite'
import { fileURLToPath } from 'node:url'

await build({
  configFile: false,
  root: fileURLToPath(new URL('..', import.meta.url)),
  plugins: (await import('@vitejs/plugin-react')).default(),
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
})
