import { mutationOptions, queryOptions } from '@tanstack/react-query';

import { buildItemByIdKey, buildItemsByContainerKey } from '@/kernel/item/keys';

import type { components } from '@/kernel/api/schema';
import { queryClient } from '@/shared/api/query-client';

import { createItemRequest } from './create';
import { deleteItemRequest } from './delete';
import { findItemByIdRequest } from './find-by-id';
import { findItemsByContainerRequest } from './find-by-container';
import { updateItemRequest } from './update';

type UpdateItemDto = components['schemas']['UpdateItemDto'];

export const itemQueries = {
  byContainer: (containerId: string) =>
    queryOptions({
      queryKey: buildItemsByContainerKey(containerId),
      queryFn: () => findItemsByContainerRequest(containerId),
    }),

  byId: (id: string) =>
    queryOptions({
      queryKey: buildItemByIdKey(id),
      queryFn: () => findItemByIdRequest(id),
    }),

  create: () =>
    mutationOptions({
      mutationFn: createItemRequest,
      onSuccess: data => {
        queryClient.invalidateQueries({
          queryKey: buildItemsByContainerKey(data.containerId),
        });
      },
    }),

  update: () =>
    mutationOptions({
      mutationFn: (vars: {
        id: string;
        containerId: string;
        dto: UpdateItemDto;
      }) => updateItemRequest(vars.id, vars.dto),
      onSuccess: (_data, vars) => {
        queryClient.invalidateQueries({
          queryKey: buildItemsByContainerKey(vars.containerId),
        });
        queryClient.invalidateQueries({
          queryKey: buildItemByIdKey(vars.id),
        });
      },
    }),

  delete: () =>
    mutationOptions({
      mutationFn: (vars: { id: string; containerId: string }) =>
        deleteItemRequest(vars.id),
      onSuccess: (_data, vars) => {
        queryClient.invalidateQueries({
          queryKey: buildItemsByContainerKey(vars.containerId),
        });
      },
    }),
};
