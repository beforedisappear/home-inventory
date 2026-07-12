import { mutationOptions, queryOptions } from '@tanstack/react-query';

import {
  buildContainerByIdKey,
  buildContainerChildrenKey,
} from '@/kernel/container/keys';

import { queryClient } from '@/shared/api/query-client';

import { createContainerRequest } from './create';
import { deleteContainerRequest } from './delete';
import { findContainerByIdRequest } from './find-by-id';
import { findChildrenRequest } from './find-children';

export const containerQueries = {
  children: (parentId: string | null) =>
    queryOptions({
      queryKey: buildContainerChildrenKey(parentId),
      queryFn: () => findChildrenRequest(parentId),
    }),

  byId: (id: string) =>
    queryOptions({
      queryKey: buildContainerByIdKey(id),
      queryFn: () => findContainerByIdRequest(id),
    }),

  create: () =>
    mutationOptions({
      mutationFn: createContainerRequest,
      onSuccess: data => {
        queryClient.invalidateQueries({
          queryKey: buildContainerChildrenKey(data.parentId),
        });
      },
    }),

  delete: () =>
    mutationOptions({
      mutationFn: (vars: { id: string; parentId: string | null }) =>
        deleteContainerRequest(vars.id),
      onSuccess: (_data, vars) => {
        queryClient.invalidateQueries({
          queryKey: buildContainerChildrenKey(vars.parentId),
        });
        queryClient.removeQueries({ queryKey: buildContainerByIdKey(vars.id) });
      },
    }),
};
