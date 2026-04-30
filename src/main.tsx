import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import '@fontsource/plus-jakarta-sans/latin-400.css'
import '@fontsource/plus-jakarta-sans/latin-500.css'
import '@fontsource/plus-jakarta-sans/latin-600.css'
import '@fontsource/plus-jakarta-sans/latin-700.css'
import './styles/index.css'
import App from './App.tsx'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 1000 * 60 * 5,
      gcTime: 1000 * 60 * 15,
      refetchOnWindowFocus: false,
      retry: 1,
    },
  },
})

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error('Failed to find the root element');

createRoot(rootElement).render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <App />
      <Toaster
        position="top-right"
        gutter={10}
        toastOptions={{
          duration: 3600,
          style: {
            borderRadius: '14px',
            border: '1px solid rgba(148, 163, 184, 0.24)',
            background: 'linear-gradient(135deg, #f8fafc 0%, #eef2ff 100%)',
            color: '#0f172a',
            boxShadow: '0 14px 34px rgba(15, 23, 42, 0.15)',
            padding: '12px 14px',
            fontSize: '0.9rem',
            fontWeight: '600',
            maxWidth: '420px',
          },
          success: {
            iconTheme: {
              primary: '#059669',
              secondary: '#ecfdf5',
            },
          },
          error: {
            iconTheme: {
              primary: '#dc2626',
              secondary: '#fef2f2',
            },
          },
        }}
      />
    </QueryClientProvider>
  </StrictMode>,
)
