import { createRoot } from 'react-dom/client';
import { initSentry } from './services/sentry';
import { AuthProvider } from './contexts/AuthContext';
import { WalletProvider } from './contexts/WalletContext';
import './index.css';
import App from './App.jsx';

initSentry();

createRoot(document.getElementById('root')).render(
  <AuthProvider>
    <WalletProvider>
      <App />
    </WalletProvider>
  </AuthProvider>,
);
