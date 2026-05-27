import { defineConfig } from 'vite'
import { svelte } from '@sveltejs/vite-plugin-svelte'
import typegpuVite from 'unplugin-typegpu/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [typegpuVite(), svelte()],
})
