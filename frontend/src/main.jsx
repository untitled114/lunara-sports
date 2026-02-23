import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App'
import './index.css'
import './styles.css'
import { ErrorBoundary } from './components/ui'
import { ThemeProvider } from './context/ThemeContext'

ReactDOM.createRoot(document.getElementById('react-root')).render(
  <React.StrictMode>
    <ErrorBoundary>
      <ThemeProvider>
        <App />
      </ThemeProvider>
    </ErrorBoundary>
  </React.StrictMode>
)
