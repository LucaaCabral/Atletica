import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { App } from './App';
// Só os subconjuntos latin/latin-ext (cobrem PT-BR) — evita baixar/cachear
// glifos cirílico, grego e vietnamita que este app nunca usa.
import '@fontsource/inter/latin-400.css';
import '@fontsource/inter/latin-500.css';
import '@fontsource/inter/latin-600.css';
import '@fontsource/inter/latin-700.css';
import '@fontsource/inter/latin-ext-400.css';
import '@fontsource/inter/latin-ext-500.css';
import '@fontsource/inter/latin-ext-600.css';
import '@fontsource/inter/latin-ext-700.css';
import './styles/global.css';

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
