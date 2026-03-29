import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

export default defineConfig({
  // Vitest charge aussi la config Vite: éviter l'écoute réseau (0.0.0.0) en environnement sandbox.
  // `process.env.VITEST` est défini par Vitest.
  plugins: process.env.VITEST ? [] : [react()],
  server: {
    host: process.env.VITEST ? '127.0.0.1' : true,
    hmr: process.env.VITEST ? false : undefined,
    port: 5173,
    strictPort: true
  },
  preview: {
    host: process.env.VITEST ? '127.0.0.1' : true,
    port: 4173,
    strictPort: true
  }
})
