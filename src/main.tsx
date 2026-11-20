import { StrictMode, Suspense, lazy } from 'react'
import { Capacitor } from '@capacitor/core'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'

const OtaScreen = lazy(() => import('./components/OtaScreen.tsx'));
const isOtaPage = !Capacitor.isNativePlatform() && /\/OTA\/?$/.test(window.location.pathname);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    {isOtaPage ? <Suspense fallback={<p>Loading firmware administration…</p>}><OtaScreen /></Suspense> : <App />}
  </StrictMode>,
)
