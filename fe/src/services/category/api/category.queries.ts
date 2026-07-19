import { queryOptions } from '@tanstack/react-query';

import { buildCategoryListKey } from '@/kernel/category/keys';

import { findAllCategoriesRequest } from './find-all';

export const categoryQueries = {
  list: () =>
    queryOptions({
      queryKey: buildCategoryListKey(),
      queryFn: findAllCategoriesRequest,
    }),
};
