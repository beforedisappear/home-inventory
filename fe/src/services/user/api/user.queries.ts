import { mutationOptions } from '@tanstack/react-query';

import { buildSessionMeKey } from '@/kernel/session/query-keys';

import { queryClient } from '@/shared/api/query-client';

import { confirmEmailChangeRequest } from './confirm-email-change';
import { requestEmailChangeRequest } from './request-email-change';
import { updateNameRequest } from './update-name';

export const userQueries = {
  updateName: () =>
    mutationOptions({
      mutationFn: updateNameRequest,
      onSuccess: data => {
        queryClient.setQueryData(buildSessionMeKey(), data);
      },
    }),

  requestEmailChange: () =>
    mutationOptions({
      mutationFn: requestEmailChangeRequest,
    }),

  confirmEmailChange: () =>
    mutationOptions({
      mutationFn: confirmEmailChangeRequest,
      onSuccess: data => {
        queryClient.setQueryData(buildSessionMeKey(), data);
      },
    }),
};
