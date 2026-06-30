import { mutationOptions, queryOptions } from '@tanstack/react-query';

import { buildSessionMeKey } from '@/kernel/session/keys';

import { queryClient } from '@/shared/api/query-client';
import { tokenStorage } from '@/shared/api/token-storage';

import { authenticateRequest } from './authenticate';
import { logoutRequest } from './logout';
import { meRequest } from './me';
import { sendCodeRequest } from './send-code';

export const sessionQueries = {
  sendCode: () =>
    mutationOptions({
      mutationFn: sendCodeRequest,
    }),

  authenticate: () =>
    mutationOptions({
      mutationFn: authenticateRequest,
      onSuccess: data => {
        tokenStorage.setTokens(data.accessToken, data.refreshToken);
      },
    }),

  me: () =>
    queryOptions({
      queryKey: buildSessionMeKey(),
      queryFn: meRequest,
    }),

  logout: () =>
    mutationOptions({
      mutationKey: ['session', 'logout'],
      mutationFn: logoutRequest,
      onSettled: () => {
        tokenStorage.clear();
        queryClient.clear();
      },
    }),
};
