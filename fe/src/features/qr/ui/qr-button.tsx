import { Download, QrCode } from 'lucide-react';

import { Spinner } from '@/shared/ui';

import { useQr } from '../model/use-qr';
import type { QrResponse, QrTriggerProps } from '../model/types';

export function QrButton<T extends QrResponse>(props: QrTriggerProps<T>) {
  const { entityId, qrQueryOptions, generateMutationOptions } = props;

  const { status, isGenerating, isDownloading, handleGenerate, handleDownload } =
    useQr({ entityId, qrQueryOptions, generateMutationOptions });

  if (status === 'ready') {
    return (
      <button
        type='button'
        aria-label='Скачать QR-код'
        disabled={isDownloading}
        className='flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-secondary hover:text-primary disabled:pointer-events-none'
        onClick={event => {
          event.preventDefault();
          void handleDownload();
        }}
      >
        {isDownloading ? <Spinner size='sm' /> : <Download size={16} />}
      </button>
    );
  }

  const isBusy = isGenerating || status === 'pending';

  return (
    <button
      type='button'
      aria-label='Сгенерировать QR-код'
      disabled={isBusy}
      className='flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-secondary hover:text-primary disabled:pointer-events-none'
      onClick={event => {
        event.preventDefault();
        handleGenerate();
      }}
    >
      {isBusy ? <Spinner size='sm' /> : <QrCode size={16} />}
    </button>
  );
}
