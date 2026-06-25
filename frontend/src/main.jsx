import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import axios from 'axios';
import { GoogleOAuthProvider } from '@react-oauth/google';
import './index.css'
import ErrorBoundary from './ErrorBoundary.jsx'
import App from './App.jsx'

axios.defaults.headers.common['Bypass-Tunnel-Reminder'] = 'true';
axios.defaults.headers.common['ngrok-skip-browser-warning'] = '69420';


createRoot(document.getElementById('root')).render(
  <StrictMode>
    <ErrorBoundary>
      <GoogleOAuthProvider clientId={import.meta.env.VITE_GOOGLE_CLIENT_ID}>
        <App />
      </GoogleOAuthProvider>
    </ErrorBoundary>
  </StrictMode>,
)
