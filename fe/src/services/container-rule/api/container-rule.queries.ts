import { mutationOptions, queryOptions } from '@tanstack/react-query';

import {
  buildContainerRuleByIdKey,
  buildContainerRuleListKey,
} from '@/kernel/container/keys';

import { queryClient } from '@/shared/api/query-client';

import { createContainerRuleRequest } from './create';
import { findAllContainerRulesRequest } from './find-all';
import { findContainerRuleByIdRequest } from './find-by-id';

export const containerRuleQueries = {
  byId: (id: string) =>
    queryOptions({
      queryKey: buildContainerRuleByIdKey(id),
      queryFn: () => findContainerRuleByIdRequest(id),
    }),

  list: () =>
    queryOptions({
      queryKey: buildContainerRuleListKey(),
      queryFn: findAllContainerRulesRequest,
    }),

  create: () =>
    mutationOptions({
      mutationFn: createContainerRuleRequest,
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: buildContainerRuleListKey(),
        });
      },
    }),
};
