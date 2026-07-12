import { useCallback, useState } from 'react';

import { useMutation } from '@tanstack/react-query';

import { containerQueries } from '@/services/container';

import { useEvent } from '@/shared/lib/event-emitter';
import { AlertDialog, Button, toast, useOverlayState } from '@/shared/ui';

import type { ContainerDeleteRequest } from '../model/container-delete-emitter';
import { containerDeleteEmitter } from '../model/container-delete-emitter';

export function ContainerDeleteDialog() {
  const [target, setTarget] = useState<ContainerDeleteRequest | null>(null);
  const state = useOverlayState();

  const handleOpen = useCallback(
    (request: ContainerDeleteRequest) => {
      setTarget(request);
      state.open();
    },
    [state],
  );

  useEvent(containerDeleteEmitter, 'open', handleOpen);

  const { mutateAsync: deleteContainer, isPending: isDeleting } = useMutation(
    containerQueries.delete(),
  );

  const handleDelete = async () => {
    if (!target) return;

    try {
      await deleteContainer({
        id: target.containerId,
        parentId: target.parentId,
      });
      state.close();
      target.onDeleted?.();
    } catch {
      toast.danger(
        'Контейнер не пуст — уберите вложенные контейнеры и вещи, чтобы удалить',
      );
    }
  };

  return (
    <AlertDialog.Root isOpen={state.isOpen} onOpenChange={state.setOpen}>
      <AlertDialog.Backdrop>
        <AlertDialog.Container>
          <AlertDialog.Dialog>
            <div className='flex items-center gap-3'>
              <AlertDialog.Icon />
              <AlertDialog.Header className='mb-0'>
                <AlertDialog.Heading>
                  Удалить «{target?.containerName}»?
                </AlertDialog.Heading>
              </AlertDialog.Header>
            </div>
            <AlertDialog.Body className='mt-2'>
              Это действие нельзя отменить.
            </AlertDialog.Body>
            <AlertDialog.Footer>
              <Button type='button' variant='ghost' onPress={state.close}>
                Отмена
              </Button>
              <Button
                type='button'
                variant='danger'
                isDisabled={isDeleting}
                onPress={handleDelete}
              >
                Удалить
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog.Root>
  );
}
