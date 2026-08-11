import { mutationOptions, queryOptions } from '@tanstack/react-query';

import type { components } from '@/kernel/api/schema';
import { queryClient } from '@/shared/api/query-client';

import { createDocumentRequest } from './create';
import { deleteDocumentRequest } from './delete';
import { listDocumentsRequest } from './list';
import { updateDocumentRequest } from './update';
import { uploadDocumentFileRequest } from './upload-file';

type UpdateDocumentDto = components['schemas']['UpdateDocumentDto'];

export const documentQueries = {
  byItemKey: (itemId: string) => ['documents', 'by-item', itemId] as const,

  byItem: (itemId: string) =>
    queryOptions({
      queryKey: documentQueries.byItemKey(itemId),
      queryFn: () => listDocumentsRequest(itemId),
    }),

  uploadFile: () =>
    mutationOptions({
      mutationFn: uploadDocumentFileRequest,
    }),

  create: () =>
    mutationOptions({
      mutationFn: createDocumentRequest,
      onSuccess: data => {
        queryClient.invalidateQueries({
          queryKey: documentQueries.byItemKey(data.itemId),
        });
      },
    }),

  update: () =>
    mutationOptions({
      mutationFn: (vars: {
        id: string;
        itemId: string;
        dto: UpdateDocumentDto;
      }) => updateDocumentRequest(vars.id, vars.dto),
      onSuccess: (_data, vars) => {
        queryClient.invalidateQueries({
          queryKey: documentQueries.byItemKey(vars.itemId),
        });
      },
    }),

  delete: () =>
    mutationOptions({
      mutationFn: (vars: { id: string; itemId: string }) =>
        deleteDocumentRequest(vars.id),
      onSuccess: (_data, vars) => {
        queryClient.invalidateQueries({
          queryKey: documentQueries.byItemKey(vars.itemId),
        });
      },
    }),
};
