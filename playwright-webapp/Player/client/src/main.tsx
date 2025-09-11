import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { InsightProvider } from '@semoss/sdk-react';


createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <InsightProvider>
      <App />
    </InsightProvider>
  </StrictMode>,
)