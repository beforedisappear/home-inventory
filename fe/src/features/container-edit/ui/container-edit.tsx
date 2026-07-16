import { Pencil } from 'lucide-react';

import { Button, useOverlayState } from '@/shared/ui';

import { ContainerEditForm } from './container-edit-form';
import { ContainerEditModal } from './container-edit-modal';

interface Props {
  containerId: string;
  parentId: string | null;
  name: string;
}

export function ContainerEdit(props: Props) {
  const { containerId, parentId, name } = props;
  const state = useOverlayState();

  return (
    <>
      <Button
        type='button'
        isIconOnly
        variant='ghost'
        size='sm'
        aria-label='Редактировать контейнер'
        onPress={state.open}
      >
        <Pencil size={16} />
      </Button>

      <ContainerEditModal state={state}>
        <ContainerEditForm
          containerId={containerId}
          parentId={parentId}
          name={name}
          onSuccess={state.close}
        />
      </ContainerEditModal>
    </>
  );
}
