import { defineConfig } from 'vite'
import react from '@vitejs/plugin-react'

// https://vite.dev/config/
export default defineConfig({
  plugins: [react()],
  build: {
    rollupOptions: {
      output: {
        manualChunks(id) {
          if (!id.includes('node_modules')) {
            return
          }

          if (id.includes('/react/') || id.includes('/react-dom/')) {
            return 'react'
          }

          if (id.includes('/@tanstack/react-query/')) {
            return 'query'
          }

          if (id.includes('/@supabase/supabase-js/')) {
            return 'supabase'
          }

          if (id.includes('/lucide-react/') || id.includes('/react-select/') || id.includes('/react-datepicker/')) {
            return 'ui'
          }

          return 'vendor'
        },
      },
    },
  },
})
