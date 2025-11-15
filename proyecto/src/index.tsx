import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import App from './App'; // ✅ ruta corregida
import './dashboard.css';

const root = ReactDOM.createRoot(document.getElementById('root') as HTMLElement);

root.render(
  <React.StrictMode>
    <Router>
      <Routes>
        <Route path="/" element={<App />} />
        <Route path="/habits" element={<App />} />
        <Route path="/stats" element={<App />} />
      </Routes>
    </Router>
  </React.StrictMode>
);