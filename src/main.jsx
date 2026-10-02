import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import App from './App.jsx'
import MinimalPortfolio from './MinimalPortfolio.jsx'
import './styles.css'

if (location.pathname === '/current') {
  try {
    localStorage.setItem('portfolio-space-visited', 'true')
  } catch {
    // The space page should still open when browser storage is unavailable.
  }
} else {
  const favicon = document.getElementById('site-favicon')
  favicon.href = '/life-favicon.png'
  favicon.type = 'image/png'
}

createRoot(document.getElementById('root')).render(
  <StrictMode>
    {location.pathname === '/current' ? <App /> : <MinimalPortfolio />}
  </StrictMode>,
)
