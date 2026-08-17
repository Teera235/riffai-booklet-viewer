import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  plugins: [react()],
  base: '/',
  build: {
    outDir: 'docs',
    emptyOutDir: true,
    target: ['es2018', 'safari14', 'ios14', 'chrome87', 'firefox78'],
    assetsInlineLimit: 4096,
  },
})
