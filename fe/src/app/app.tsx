/* eslint-disable react-refresh/only-export-components */
import { StrictMode } from 'react';

import { RouterProvider } from '@tanstack/react-router';
import { createRoot } from 'react-dom/client';

import { Providers } from './providers/providers';
import { router } from './routes/router';
import './styles/index.css';

/*
 * app entry point
 */
function App () {
  return (
     <Providers>
        <RouterProvider router={router} />
      </Providers>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App/>
  </StrictMode>,
);
