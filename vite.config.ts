import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'

// GitHub Pages project site: https://<user>.github.io/kyiv-paddle-map/
export default defineConfig({
  plugins: [svelte()],
  base: '/kyiv-paddle-map/',
})
