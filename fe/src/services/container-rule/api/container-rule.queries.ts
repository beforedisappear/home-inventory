import { queryOptions } from '@tanstack/react-query';

import { buildContainerRuleByIdKey } from '@/kernel/container/keys';

import { findContainerRuleByIdRequest } from './find-by-id';

export const containerRuleQueries = {
  byId: (id: string) =>
    queryOptions({
      queryKey: buildContainerRuleByIdKey(id),
      queryFn: () => findContainerRuleByIdRequest(id),
    }),
};
