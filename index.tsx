import React from 'react';
import ReactDOM from 'react-dom/client';
import { ToastProvider } from './contexts/ToastContext';
import App from './App';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Root not found");

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <ToastProvider>
      <App />
    </ToastProvider>
  </React.StrictMode>
);