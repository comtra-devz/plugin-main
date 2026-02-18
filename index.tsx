import React from 'react';
import ReactDOM from 'react-dom/client';
import { Launcher } from './Launcher';

const rootElement = document.getElementById('root');
if (!rootElement) throw new Error("Root not found");

const root = ReactDOM.createRoot(rootElement);
root.render(
  <React.StrictMode>
    <Launcher />
  </React.StrictMode>
);