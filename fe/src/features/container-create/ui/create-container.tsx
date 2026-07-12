import { Plus } from 'lucide-react';

import { Button, useOverlayState } from '@/shared/ui';

import { CreateContainerForm } from './create-container-form';
import { CreateContainerModal } from './create-container-modal';

interface Props {
  parentId: string | null;
}

export function CreateContainer({ parentId }: Props) {
  const state = useOverlayState();

  return (
    <>
      <Button
        type='button'
        isIconOnly
        size='sm'
        aria-label='Добавить контейнер'
        onPress={state.open}
      >
        <Plus size={16} />
      </Button>

      <CreateContainerModal state={state}>
        <CreateContainerForm parentId={parentId} onSuccess={state.close} />
      </CreateContainerModal>
    </>
  );
}
