import { Download, QrCode } from 'lucide-react';

import {
  AdaptiveModal,
  ErrorState,
  Spinner,
  type UseOverlayStateReturn,
} from '@/shared/ui';

import { useQr } from '../model/use-qr';
import type { QrResponse, QrTriggerProps } from '../model/types';

interface Props<T extends QrResponse> extends QrTriggerProps<T> {
  state: UseOverlayStateReturn;
}

export function QrModal<T extends QrResponse>(props: Props<T>) {
  const { entityId, qrQueryOptions, generateMutationOptions, state } = props;

  const {
    status,
    url,
    isGenerating,
    isDownloading,
    handleGenerate,
    handleDownload,
  } = useQr({ entityId, qrQueryOptions, generateMutationOptions });

  const isBusy = isGenerating || status === 'pending';
  const isReady = status === 'ready' && !!url;

  return (
    <AdaptiveModal state={state} heading='QR-код'>
      <AdaptiveModal.Body className='flex flex-col items-center gap-3 py-2'>
        {status === 'failed' && (
          <ErrorState onRetry={handleGenerate}>
            Не удалось сгенерировать QR-код
          </ErrorState>
        )}

        {isReady && (
          <div className='relative size-40'>
            <img
              src={url}
              alt='QR-код'
              className='size-40 rounded-lg border border-border bg-white p-2'
            />

            <button
              type='button'
              onClick={handleDownload}
              disabled={isDownloading}
              aria-label='Скачать QR-код'
              className='absolute -right-2 -bottom-2 flex size-8 items-center justify-center rounded-full border border-border bg-surface text-muted shadow-sm transition-colors hover:text-primary disabled:pointer-events-none'
            >
              {isDownloading ? <Spinner size='sm' /> : <Download size={16} />}
            </button>
          </div>
        )}

        {status !== 'failed' && !isReady && (
          <button
            type='button'
            onClick={handleGenerate}
            disabled={isBusy}
            className='flex size-40 flex-col items-center justify-center gap-1.5 rounded-lg border border-dashed border-border-tertiary text-muted transition-colors hover:border-primary hover:text-primary disabled:pointer-events-none'
          >
            {isBusy && <Spinner size='sm' />}

            {!isBusy && (
              <>
                <QrCode size={28} />
                <span className='text-sm'>Сгенерировать</span>
              </>
            )}
          </button>
        )}
      </AdaptiveModal.Body>
    </AdaptiveModal>
  );
}
