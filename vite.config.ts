import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// `process.env.VITE_BASE` is set by the GitHub Pages deploy workflow to "/HawkVentory/".
// Locally it's undefined, so we serve from "/".
export default defineConfig({
  base: process.env.VITE_BASE ?? '/',
  plugins: [react(), tailwindcss()],
})
