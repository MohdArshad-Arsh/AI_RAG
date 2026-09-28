import React from 'react'
import ReactDOM from 'react-dom/client'
import { BrowserRouter } from 'react-router-dom'
import { QueryClient, QueryClientProvider } from '@tanstack/react-query'
import { Toaster } from 'react-hot-toast'
import App from './App'
import './styles/globals.css'

const queryClient = new QueryClient({
  defaultOptions: {
    queries: { retry: 1, staleTime: 1000 * 60 * 5 }
  }
})

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <QueryClientProvider client={queryClient}>
      <BrowserRouter>
        <App />
        <Toaster
          position="bottom-right"
          toastOptions={{
            style: {
              background: '#1E2229',
              color: '#E8EAF0',
              border: '1px solid rgba(255,255,255,0.1)',
              fontFamily: 'IBM Plex Sans',
              fontSize: '13px',
            },
            success: { iconTheme: { primary: '#3DD68C', secondary: '#1E2229' } },
            error:   { iconTheme: { primary: '#F7614F', secondary: '#1E2229' } },
          }}
        />
      </BrowserRouter>
    </QueryClientProvider>
  </React.StrictMode>
)
