import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    modulePreload: {
      resolveDependencies(_filename, deps) {
        return deps.filter((dependency) => !dependency.includes('mapbox'))
      },
    },
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (id.includes('node_modules/mapbox-gl')) {
            return 'mapbox'
          }

          if (id.includes('node_modules/lucide-react')) {
            return 'icons'
          }

          if (id.includes('node_modules/react') || id.includes('node_modules/react-dom')) {
            return 'react'
          }

          return undefined
        },
      },
    },
  },
  server: {
    host: true,
    proxy: {
      '/api': 'http://localhost:8080',
      '/uploads': 'http://localhost:8080',
      '/demo': 'http://localhost:8080',
    },
  },
  preview: {
    host: true,
  },
})
