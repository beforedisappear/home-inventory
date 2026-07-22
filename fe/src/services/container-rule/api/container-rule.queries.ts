import { mutationOptions, queryOptions } from '@tanstack/react-query';

import { queryClient } from '@/shared/api/query-client';

import { createContainerRuleRequest } from './create';
import { findAllContainerRulesRequest } from './find-all';
import { findContainerRuleByIdRequest } from './find-by-id';

export const containerRuleQueries = {
  byIdKey: (id: string) => ['container-rule', id] as const,

  listKey: () => ['container-rule', 'list'] as const,

  byId: (id: string) =>
    queryOptions({
      queryKey: containerRuleQueries.byIdKey(id),
      queryFn: () => findContainerRuleByIdRequest(id),
    }),

  list: () =>
    queryOptions({
      queryKey: containerRuleQueries.listKey(),
      queryFn: findAllContainerRulesRequest,
    }),

  create: () =>
    mutationOptions({
      mutationFn: createContainerRuleRequest,
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: containerRuleQueries.listKey(),
        });
      },
    }),
};
