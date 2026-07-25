import { useState } from 'react';
import { useMutation, useQuery } from '@tanstack/react-query';

import { toast } from '@/shared/ui';

import type { QrResponse, QrTriggerProps } from './types';

export function useQr<T extends QrResponse>({
  entityId,
  qrQueryOptions,
  generateMutationOptions,
}: QrTriggerProps<T>) {
  const { data } = useQuery(qrQueryOptions);

  const { mutate, isPending: isGenerating } = useMutation(
    generateMutationOptions,
  );

  const [isDownloading, setIsDownloading] = useState(false);

  const handleGenerate = () => {
    mutate(entityId, {
      onError: () => toast.danger('Не удалось запустить генерацию QR-кода'),
    });
  };

  const handleDownload = async () => {
    const url = data?.url;
    if (!url) return;

    setIsDownloading(true);

    try {
      const response = await fetch(url);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `qr-${entityId}.svg`;
      link.click();

      URL.revokeObjectURL(blobUrl);
    } catch {
      toast.danger('Не удалось скачать QR-код');
    } finally {
      setIsDownloading(false);
    }
  };

  return {
    status: data?.status ?? 'none',
    url: data?.url ?? null,
    isGenerating,
    isDownloading,
    handleGenerate,
    handleDownload,
  };
}
