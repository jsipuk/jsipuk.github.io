import React from 'react';
import { createRoot } from 'react-dom/client';

/* Inter is bundled rather than pulled from Google Fonts: this is a tool you
   use at a desk with a card in front of you, and it should look right with
   the network off. The variable file covers all four CONSAU weights. */
import '@fontsource-variable/inter';

import GradeBench from './App.jsx';

createRoot(document.getElementById('root')).render(
  <React.StrictMode>
    <GradeBench />
  </React.StrictMode>,
);
