import createFetchClient, { type Middleware } from 'openapi-fetch';

import { tokenStorage } from '@/shared/api/token-storage';
import { env } from '@/shared/config/env';

import { refreshOnce } from './refresh-once';
import type { ApiPaths } from './registry';

// клон запроса (с телом) до отправки — чтобы повторить после refresh
const originals = new WeakMap<Request, Request>();

const authMiddleware: Middleware = {
  onRequest({ request }) {
    const access = tokenStorage.getAccess();

    if (access) request.headers.set('Authorization', `Bearer ${access}`);

    originals.set(request, request.clone());

    return request;
  },

  async onResponse({ request, response }) {
    const original = originals.get(request);

    originals.delete(request);

    if (response.status !== 401 || !original) return response;

    const refreshed = await refreshOnce();

    if (!refreshed) {
      tokenStorage.clear();

      return response;
    }

    const retry = original.clone();

    const access = tokenStorage.getAccess();

    if (access) retry.headers.set('Authorization', `Bearer ${access}`);

    return fetch(retry);
  },
};

// базовый openapi-fetch клиент
export const apiClient = createFetchClient<ApiPaths>({
  baseUrl: env.apiUrl,
});

apiClient.use(authMiddleware);
