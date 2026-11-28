import {StrictMode} from 'react';
import {createRoot} from 'react-dom/client';
import App from './App.tsx';
import './index.css';
import { initAll } from '@amplitude/unified';

// Amplitude analytics. The project API key is public (ingestion only) and is
// read from VITE_AMPLITUDE_API_KEY at build time.
const amplitudeKey = import.meta.env.VITE_AMPLITUDE_API_KEY;
if (!amplitudeKey) {
  console.error('[amplitude] VITE_AMPLITUDE_API_KEY is not set — no events will be sent');
} else {
  initAll(amplitudeKey, {
    serverZone: 'US',
    analytics: { autocapture: true },
    sessionReplay: { sampleRate: 1 },
  });
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
