import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from '@tanstack/react-router';

import { HomePage } from '@/pages/home';
import { LoginPage } from '@/pages/login';

import { tokenStorage } from '@/shared/api/token-storage';

import { RootLayout } from '../layouts/root-layout';

// Регистрируем типы (чтобы роутер работал с TS без костылей)
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

export const rootRoute = createRootRoute({
  component: RootLayout,
});

const protectedRoute = createRoute({
  id: 'protected',
  getParentRoute: () => rootRoute,
  beforeLoad: () => {
    if (!tokenStorage.getAccess()) {
      throw redirect({ to: '/login' });
    }
  },
});

const indexRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: '/',
  component: HomePage,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
});

const routeTree = rootRoute.addChildren([
  protectedRoute.addChildren([indexRoute]),
  loginRoute,
]);

export const router = createRouter({ routeTree });
