import { Plus } from 'lucide-react';

import { useOverlayState } from '@/shared/ui';

import { CreateItemForm } from './create-item-form';
import { CreateItemModal } from './create-item-modal';

interface Props {
  containerId: string;
}

export function CreateItem({ containerId }: Props) {
  const state = useOverlayState();

  return (
    <>
      <button
        type='button'
        onClick={state.open}
        className='flex w-full items-center justify-center gap-2 rounded-lg border border-dashed border-border-tertiary px-4 py-3 text-muted transition-colors hover:bg-surface-secondary'
      >
        <Plus size={16} />
        <span className='text-sm'>Добавить вещь</span>
      </button>

      <CreateItemModal state={state}>
        <CreateItemForm containerId={containerId} onSuccess={state.close} />
      </CreateItemModal>
    </>
  );
}
