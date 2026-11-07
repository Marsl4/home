import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { initTitleBarSpace } from './sections/settings/titleBar'

initTitleBarSpace() // Mac-Web-App: Platz für die Safari-Leiste oben

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
