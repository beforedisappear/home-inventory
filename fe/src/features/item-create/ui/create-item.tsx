import type { ReactNode } from 'react';
import { Plus } from 'lucide-react';

import { useOverlayState } from '@/shared/ui';

import { CreateItemDrawer } from './create-item-drawer';
import { CreateItemForm } from './create-item-form';

interface Props {
  containerId: string;
  categorySlot?: ReactNode;
}

export function CreateItem({ containerId, categorySlot }: Props) {
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

      <CreateItemDrawer state={state}>
        <CreateItemForm
          containerId={containerId}
          onSuccess={state.close}
          categorySlot={categorySlot}
        />
      </CreateItemDrawer>
    </>
  );
}
