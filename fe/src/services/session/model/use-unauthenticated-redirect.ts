import { useEffect } from 'react';

import { useNavigate } from '@tanstack/react-router';

import { ROUTES } from '@/kernel/routes';

import { queryClient } from '@/shared/api/query-client';
import { tokenStorage } from '@/shared/api/token-storage';

// любой упавший запрос без валидного access-токена — сигнал о разлогине,
// делаем редирект на страницу логина, чтобы пользователь мог заново авторизоваться
export function useUnauthenticatedRedirect() {
  const navigate = useNavigate();

  useEffect(() => {
    const unsubscribe = queryClient.getQueryCache().subscribe(event => {
      if (
        event.type === 'updated' &&
        event.query.state.status === 'error' &&
        !tokenStorage.getAccess()
      ) {
        void navigate({ to: ROUTES.LOGIN });
      }
    });

    return () => unsubscribe();
  }, [navigate]);
}
