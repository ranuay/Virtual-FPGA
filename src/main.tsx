// SPDX-License-Identifier: GPL-2.0-only
// Copyright (C) 2026 Rune Langøy

import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import App from './App';
import { LOGO_DATA_URI } from './components/workbench/logo';
import './index.css';

// Set here, not in index.html: the mark is a data URI computed from the
// actual image (`logo.ts`), so this is the one place that needs to know it
// exists, rather than a second copy hand-encoded into the HTML.
//
// The type is PNG because that is what `logo.ts` inlines. A data URI carries
// its own media type, so the browser decodes it without help, but a stale type
// here would still be a claim about the asset that is not true of it.
const favicon = document.createElement('link');
favicon.rel = 'icon';
favicon.type = 'image/png';
favicon.href = LOGO_DATA_URI;
document.head.appendChild(favicon);

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
