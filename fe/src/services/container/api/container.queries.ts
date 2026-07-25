import { mutationOptions, queryOptions } from '@tanstack/react-query';

import { queryClient } from '@/shared/api/query-client';

import { createContainerRequest } from './create';
import { deleteContainerRequest } from './delete';
import { findContainerByIdRequest } from './find-by-id';
import { findChildrenRequest } from './find-children';
import { generateContainerQrRequest } from './generate-qr';
import { getContainerQrRequest } from './get-qr';
import { updateContainerRequest } from './update';

export const containerQueries = {
  childrenKey: (parentId: string | null) =>
    ['container', 'children', parentId] as const,

  byIdKey: (id: string) => ['container', id] as const,

  children: (parentId: string | null) =>
    queryOptions({
      queryKey: containerQueries.childrenKey(parentId),
      queryFn: () => findChildrenRequest(parentId),
    }),

  byId: (id: string) =>
    queryOptions({
      queryKey: containerQueries.byIdKey(id),
      queryFn: () => findContainerByIdRequest(id),
    }),

  create: () =>
    mutationOptions({
      mutationFn: createContainerRequest,
      onSuccess: data => {
        queryClient.invalidateQueries({
          queryKey: containerQueries.childrenKey(data.parentId),
        });
      },
    }),

  delete: () =>
    mutationOptions({
      mutationFn: (vars: { id: string; parentId: string | null }) =>
        deleteContainerRequest(vars.id),
      onSuccess: (_data, vars) => {
        queryClient.invalidateQueries({
          queryKey: containerQueries.childrenKey(vars.parentId),
        });
        queryClient.removeQueries({
          queryKey: containerQueries.byIdKey(vars.id),
        });
      },
    }),

  update: () =>
    mutationOptions({
      mutationFn: (vars: { id: string; parentId: string | null; name: string }) =>
        updateContainerRequest(vars.id, { name: vars.name }),
      onSuccess: (_data, vars) => {
        queryClient.invalidateQueries({
          queryKey: containerQueries.byIdKey(vars.id),
        });
        queryClient.invalidateQueries({
          queryKey: containerQueries.childrenKey(vars.parentId),
        });
      },
    }),

  qrKey: (id: string) => ['container', 'qr', id] as const,

  qr: (id: string) =>
    queryOptions({
      queryKey: containerQueries.qrKey(id),
      queryFn: () => getContainerQrRequest(id),
      refetchInterval: query =>
        query.state.data?.status === 'pending' ? 2000 : false,
    }),

  generateQr: () =>
    mutationOptions({
      mutationFn: (id: string) => generateContainerQrRequest(id),
      onSuccess: (_data, id) => {
        queryClient.invalidateQueries({
          queryKey: containerQueries.qrKey(id),
        });
      },
    }),
};
