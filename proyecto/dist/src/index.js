import { jsx as _jsx, jsxs as _jsxs } from "react/jsx-runtime";
import React from 'react';
import ReactDOM from 'react-dom/client';
import { BrowserRouter as Router, Routes, Route } from 'react-router-dom';
import App from './App'; // ✅ ruta corregida
import './dashboard.css';
const root = ReactDOM.createRoot(document.getElementById('root'));
root.render(_jsx(React.StrictMode, { children: _jsx(Router, { children: _jsxs(Routes, { children: [_jsx(Route, { path: "/", element: _jsx(App, {}) }), _jsx(Route, { path: "/habits", element: _jsx(App, {}) }), _jsx(Route, { path: "/stats", element: _jsx(App, {}) })] }) }) }));
