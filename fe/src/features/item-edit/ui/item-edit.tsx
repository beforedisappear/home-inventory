import { Pencil } from 'lucide-react';

import type { components } from '@/kernel/api/schema';

import { Button, useOverlayState } from '@/shared/ui';

import { ItemEditForm } from './item-edit-form';
import { ItemEditModal } from './item-edit-modal';

type ItemResponseDto = components['schemas']['ItemResponseDto'];

interface Props {
  item: ItemResponseDto;
  containerId: string;
}

export function ItemEdit(props: Props) {
  const { item, containerId } = props;
  const state = useOverlayState();

  return (
    <>
      <Button
        type='button'
        isIconOnly
        variant='ghost'
        size='sm'
        aria-label='Редактировать вещь'
        onPress={state.open}
      >
        <Pencil size={16} />
      </Button>

      <ItemEditModal state={state}>
        <ItemEditForm
          item={item}
          containerId={containerId}
          onSuccess={state.close}
        />
      </ItemEditModal>
    </>
  );
}
