import React from 'react'
import ReactDOM from 'react-dom/client'
import App from './App.tsx'
import AppRecovery from './components/AppRecovery'
import AppUpdates from './components/AppUpdates'
import './index.css'

ReactDOM.createRoot(document.getElementById('root')!).render(
  <React.StrictMode>
    <AppUpdates />
    <AppRecovery>
      <App />
    </AppRecovery>
  </React.StrictMode>,
)
