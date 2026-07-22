import React from 'react';
import ReactDOM from 'react-dom/client';
import CheckinApp from './CheckinApp.jsx';
import './styles.css';
import { Analytics } from '@vercel/analytics/react';
import { SpeedInsights } from '@vercel/speed-insights/react';

ReactDOM.createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <Analytics />
    <SpeedInsights />
    <CheckinApp />
  </React.StrictMode>,
);
