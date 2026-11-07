import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// 垂直切片原型：单页应用，产物使用相对路径，便于本地预览与后续小游戏容器内嵌。
export default defineConfig({
  plugins: [react()],
  base: './',
  server: {
    host: true,
    port: 5173,
  },
  build: {
    outDir: 'dist',
    sourcemap: false,
    chunkSizeWarningLimit: 900,
  },
})
