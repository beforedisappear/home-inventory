import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from '@tanstack/react-router';

import { HomePage } from '@/pages/home';
import { LoginPage } from '@/pages/login';
import { UserProfilePage } from '@/pages/user-profile';

import { ROUTES } from '@/kernel/routes';

import { tokenStorage } from '@/shared/api/token-storage';

import { ProtectedLayout } from '../layouts/protected-layout';
import { RootLayout } from '../layouts/root-layout';

// Регистрируем типы (чтобы роутер работал с TS без костылей)
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

const rootRoute = createRootRoute({ component: RootLayout });

const protectedRoute = createRoute({
  id: 'protected',
  getParentRoute: () => rootRoute,
  component: ProtectedLayout,
  beforeLoad: () => {
    if (!tokenStorage.getAccess()) {
      throw redirect({ to: ROUTES.LOGIN });
    }
  },
});

const indexRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: ROUTES.HOME,
  component: HomePage,
});

const profileRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: ROUTES.PROFILE,
  component: UserProfilePage,
});

const protectedRoutes = protectedRoute.addChildren([indexRoute, profileRoute]);

const publicRoutes = [
  createRoute({
    getParentRoute: () => rootRoute,
    path: ROUTES.LOGIN,
    component: LoginPage,
    beforeLoad: () => {
      if (tokenStorage.getAccess()) {
        throw redirect({ to: ROUTES.HOME });
      }
    },
  }),
];

const routeTree = rootRoute.addChildren([protectedRoutes, ...publicRoutes]);

export const router = createRouter({ routeTree });
