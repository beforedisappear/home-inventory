import { queryOptions } from '@tanstack/react-query';

import { findAllCategoriesRequest } from './find-all';

export const categoryQueries = {
  listKey: () => ['category', 'list'] as const,

  list: () =>
    queryOptions({
      queryKey: categoryQueries.listKey(),
      queryFn: findAllCategoriesRequest,
    }),
};
