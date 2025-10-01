import React from 'react';
import ReactDOM from 'react-dom/client';
import './index.css';
import './styles.css';
import App from './App.jsx';

const rootElement = document.getElementById('react-root');

if (!rootElement) {
    // This should never happen in a standard Vite setup
    console.error('❌ React root element not found.');
} else {
    console.log('🚀 Starting Lunara App via Vite...');
    
    // The main React rendering call
    ReactDOM.createRoot(rootElement).render(
        <React.StrictMode>
            <App />
        </React.StrictMode>
    );

    console.log('✅ React app rendered.');
}
