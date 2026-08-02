import { mutationOptions, queryOptions } from '@tanstack/react-query';

import { cancelRecognitionRequest } from './cancel';
import { createRecognitionRequest } from './create';
import { getRecognitionRequest } from './get-by-id';

export const recognitionQueries = {
  byIdKey: (id: string) => ['recognitions', 'by-id', id] as const,

  byId: (id: string) =>
    queryOptions({
      queryKey: recognitionQueries.byIdKey(id),
      queryFn: () => getRecognitionRequest(id),
    }),

  create: () =>
    mutationOptions({
      mutationFn: createRecognitionRequest,
    }),

  cancel: () =>
    mutationOptions({
      mutationFn: cancelRecognitionRequest,
    }),
};
