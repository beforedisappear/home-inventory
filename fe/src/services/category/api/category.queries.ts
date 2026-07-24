import { mutationOptions, queryOptions } from '@tanstack/react-query';

import { queryClient } from '@/shared/api/query-client';

import { createCategoryRequest } from './create';
import { deleteCategoryRequest } from './delete';
import { findAllCategoriesRequest } from './find-all';
import { updateCategoryRequest } from './update';

export const categoryQueries = {
  listKey: () => ['category', 'list'] as const,

  list: () =>
    queryOptions({
      queryKey: categoryQueries.listKey(),
      queryFn: findAllCategoriesRequest,
    }),

  create: () =>
    mutationOptions({
      mutationFn: createCategoryRequest,
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: categoryQueries.listKey() });
      },
    }),

  update: () =>
    mutationOptions({
      mutationFn: (vars: { id: string; name: string }) =>
        updateCategoryRequest(vars.id, { name: vars.name }),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: categoryQueries.listKey() });
      },
    }),

  delete: () =>
    mutationOptions({
      mutationFn: (vars: { id: string }) => deleteCategoryRequest(vars.id),
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: categoryQueries.listKey() });
      },
    }),
};
