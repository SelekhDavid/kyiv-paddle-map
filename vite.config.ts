import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// GitHub Pages project site: https://<user>.github.io/kyiv-paddle-map/
export default defineConfig({
  plugins: [react()],
  base: '/kyiv-paddle-map/',
})
