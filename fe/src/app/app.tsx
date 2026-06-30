/* eslint-disable react-refresh/only-export-components */
import { StrictMode } from 'react';

import { RouterProvider } from '@tanstack/react-router';
import { TanStackRouterDevtools } from '@tanstack/react-router-devtools';
import { createRoot } from 'react-dom/client';

import { env } from '@/shared/config/env';

import { Providers } from './providers/providers';
import { router } from './routes/router';
import './styles/index.css';

/*
 * app entry point
 */
function App() {
  return (
    <Providers>
      <RouterProvider router={router} />
      {env.isDev && (
        <TanStackRouterDevtools initialIsOpen={false} router={router} />
      )}
    </Providers>
  );
}

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <App />
  </StrictMode>,
);
