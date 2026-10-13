import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import vue from '@vitejs/plugin-vue'

export default defineConfig({
  plugins: [
    vue(),
  ],

  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (/\/node_modules\/(?:@vue\/|vue\/|pinia\/|vue-demi\/)/.test(id)) return 'vue-runtime'
          if (id.includes('/node_modules/jspdf/')) return 'pdf-engine'
          if (id.includes('/src/core/harmonicKnowledge.js')) return 'harmonic-knowledge'
          if (id.includes('/src/core/suggestions.js')) return 'harmonic-suggestions'
        },
      },
    },
  },

  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url))
    }
  }
})
