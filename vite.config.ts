import { defineConfig } from 'vite'
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react(), tailwindcss()],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
  // Honor a PORT env var when set (e.g. preview/dev tooling that assigns a
  // free port); falls back to Vite's default 5173 for a plain `npm run dev`.
  // Dev only: serverless functions do not run under Vite, so the version
  // check is proxied to production (read-only, public) to be testable here.
  server: {
    ...(process.env.PORT ? { port: Number(process.env.PORT) } : {}),
    proxy: { '/api/app-version': { target: 'https://concordiatracker.com', changeOrigin: true } },
  },
})
