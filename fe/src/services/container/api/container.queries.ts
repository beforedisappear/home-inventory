import { queryOptions } from '@tanstack/react-query';

import {
  buildContainerByIdKey,
  buildContainerChildrenKey,
} from '@/kernel/container/keys';

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
};
