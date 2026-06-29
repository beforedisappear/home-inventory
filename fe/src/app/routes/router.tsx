import {
  createRootRoute,
  createRoute,
  createRouter,
} from '@tanstack/react-router';

import { HomePage } from '@/pages/home';
import { LoginPage } from '@/pages/login';

import { RootLayout } from '../layouts/root-layout';

export const rootRoute = createRootRoute({
  component: RootLayout,
});

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
});

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
});

const routeTree = rootRoute.addChildren([indexRoute, loginRoute]);

export const router = createRouter({ routeTree });
