import { mutationOptions, queryOptions } from '@tanstack/react-query';

import type { components } from '@/kernel/api/schema';
import { queryClient } from '@/shared/api/query-client';

import { createItemRequest } from './create';
import { deleteItemRequest } from './delete';
import { findItemByIdRequest } from './find-by-id';
import { findItemsByContainerRequest } from './find-by-container';
import { updateItemRequest } from './update';
import { uploadItemPhotoRequest } from './upload-photo';

type UpdateItemDto = components['schemas']['UpdateItemDto'];

export const itemQueries = {
  byContainerKey: (containerId: string) =>
    ['items', 'by-container', containerId] as const,

  byIdKey: (id: string) => ['items', 'by-id', id] as const,

  byContainer: (containerId: string) =>
    queryOptions({
      queryKey: itemQueries.byContainerKey(containerId),
      queryFn: () => findItemsByContainerRequest(containerId),
    }),

  byId: (id: string) =>
    queryOptions({
      queryKey: itemQueries.byIdKey(id),
      queryFn: () => findItemByIdRequest(id),
    }),

  create: () =>
    mutationOptions({
      mutationFn: createItemRequest,
      onSuccess: data => {
        queryClient.invalidateQueries({
          queryKey: itemQueries.byContainerKey(data.containerId),
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
          queryKey: itemQueries.byContainerKey(vars.containerId),
        });
        queryClient.invalidateQueries({
          queryKey: itemQueries.byIdKey(vars.id),
        });
      },
    }),

  delete: () =>
    mutationOptions({
      mutationFn: (vars: { id: string; containerId: string }) =>
        deleteItemRequest(vars.id),
      onSuccess: (_data, vars) => {
        queryClient.invalidateQueries({
          queryKey: itemQueries.byContainerKey(vars.containerId),
        });
      },
    }),

  uploadPhotoKey: () => ['items', 'upload-photo'] as const,

  uploadPhoto: () =>
    mutationOptions({
      mutationKey: itemQueries.uploadPhotoKey(),
      mutationFn: uploadItemPhotoRequest,
    }),
};
