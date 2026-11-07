import { build } from 'vite'

await build({
  configFile: false,
  root: new URL('..', import.meta.url).pathname.replace(/^\/([A-Za-z]:)/, '$1'),
  plugins: (await import('@vitejs/plugin-react')).default(),
  base: './',
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
})
