import React from 'react';
import { createRoot } from 'react-dom/client';
import GradeBench from './App.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GradeBench />
  </React.StrictMode>,
);
