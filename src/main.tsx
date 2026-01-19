import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import './i18n'; // Initialize i18n before App renders
import App from './App.tsx';
import './index.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>
);
