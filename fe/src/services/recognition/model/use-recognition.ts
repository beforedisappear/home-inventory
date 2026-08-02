import { useEffect, useRef, useState } from 'react';

import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { toast } from '@/shared/ui';

import { onRecognitionEvent } from '../api/events';
import { recognitionQueries } from '../api/recognition.queries';

function isConflict(err: unknown): boolean {
  return (
    err !== null &&
    typeof err === 'object' &&
    'statusCode' in err &&
    (err as { statusCode?: number }).statusCode === 409
  );
}

export function useRecognition() {
  const [recognitionId, setRecognitionId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data } = useQuery({
    ...recognitionQueries.byId(recognitionId ?? ''),
    enabled: recognitionId !== null,
  });

  // отменяем незавершённое распознавание, если хук размонтировался
  const idRef = useRef(recognitionId);
  const statusRef = useRef(data?.status ?? null);

  const { mutateAsync: createRecognition, isPending: isStarting } = useMutation(
    recognitionQueries.create(),
  );
  const { mutateAsync: cancelRecognition } = useMutation(
    recognitionQueries.cancel(),
  );

  // единственный источник статуса после первого fetch — приходит ready/failed
  // по SSE, инвалидируем и рефетчим (поллинга нет, чтобы не спамить запросами)
  useEffect(() => {
    if (!recognitionId) return undefined;

    const listener = onRecognitionEvent(event => {
      if (event.recognitionId !== recognitionId) return;

      void queryClient.invalidateQueries({
        queryKey: recognitionQueries.byIdKey(recognitionId),
      });
    });

    return () => {
      listener();
    };
  }, [recognitionId, queryClient]);

  // eslint-disable-next-line react-hooks/refs
  idRef.current = recognitionId;
  // eslint-disable-next-line react-hooks/refs
  statusRef.current = data?.status ?? null;

  useEffect(() => {
    return () => {
      const id = idRef.current;
      const status = statusRef.current;

      if (id && (status === 'pending' || status === 'processing')) {
        void cancelRecognition(id);
      }
    };
  }, [cancelRecognition]);

  const start = async (file: File) => {
    try {
      const recognition = await createRecognition(file);
      setRecognitionId(recognition.id);
    } catch (err) {
      const message = isConflict(err)
        ? 'У вас уже есть активное распознавание — дождитесь его завершения'
        : 'Не удалось запустить распознавание';

      toast.danger(message);
    }
  };

  const cancel = async () => {
    if (!recognitionId) return;

    try {
      await cancelRecognition(recognitionId);
    } finally {
      setRecognitionId(null);
    }
  };

  const reset = () => setRecognitionId(null);

  return {
    status: data?.status ?? null,
    draft: data?.draft ?? null,
    error: data?.error ?? null,
    isStarting,
    start,
    cancel,
    reset,
  };
}
