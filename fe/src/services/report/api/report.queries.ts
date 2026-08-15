import { mutationOptions, queryOptions } from '@tanstack/react-query';

import { queryClient } from '@/shared/api/query-client';

import { createReportRequest } from './create';
import { deleteReportRequest } from './delete';
import { listReportsRequest } from './list';

export const reportQueries = {
  listKey: ['report', 'list'] as const,

  list: () =>
    queryOptions({
      queryKey: reportQueries.listKey,
      queryFn: listReportsRequest,
    }),

  create: () =>
    mutationOptions({
      mutationFn: createReportRequest,
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: reportQueries.listKey });
      },
    }),

  delete: () =>
    mutationOptions({
      mutationFn: deleteReportRequest,
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: reportQueries.listKey });
      },
    }),
};
