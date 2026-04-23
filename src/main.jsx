import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App.jsx';
import { AuthProvider } from './contexts/AuthContext.jsx';
import { PrefsProvider } from './contexts/PrefsContext.jsx';

createRoot(document.getElementById('root')).render(
  <StrictMode>
    <AuthProvider>
      <PrefsProvider>
        <App />
      </PrefsProvider>
    </AuthProvider>
  </StrictMode>
);
