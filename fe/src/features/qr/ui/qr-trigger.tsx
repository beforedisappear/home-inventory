import { QrCode } from 'lucide-react';

import { Button, useOverlayState } from '@/shared/ui';

import type { QrResponse, QrTriggerProps } from '../model/types';
import { QrModal } from './qr-modal';

export function QrTrigger<T extends QrResponse>(props: QrTriggerProps<T>) {
  const { entityId, qrQueryOptions, generateMutationOptions } = props;

  const state = useOverlayState();

  return (
    <>
      <Button
        type='button'
        isIconOnly
        variant='ghost'
        size='sm'
        aria-label='QR-код'
        onPress={state.open}
      >
        <QrCode size={16} />
      </Button>

      <QrModal
        entityId={entityId}
        qrQueryOptions={qrQueryOptions}
        generateMutationOptions={generateMutationOptions}
        state={state}
      />
    </>
  );
}
