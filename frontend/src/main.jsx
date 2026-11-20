import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.jsx'

// Auto-inject Authorization header for all API fetches without mutating caller options
const originalFetch = window.fetch;
window.fetch = async (url, options = {}) => {
  const token = localStorage.getItem('auth_token');
  const urlStr = typeof url === 'string' ? url : url instanceof URL ? url.href : url?.url || '';
  if (token && urlStr.includes('/api/')) {
    const baseHeaders = options.headers || (typeof Request !== 'undefined' && url instanceof Request ? url.headers : undefined);
    const headers = new Headers(baseHeaders);
    if (!headers.has('Authorization')) {
      headers.set('Authorization', `Bearer ${token}`);
    }
    return originalFetch(url, { ...options, headers });
  }
  return originalFetch(url, options);
};

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <App />
  </StrictMode>,
)
