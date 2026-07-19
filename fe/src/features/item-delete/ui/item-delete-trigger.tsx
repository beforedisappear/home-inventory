import { Trash2 } from 'lucide-react';

import { useMutation } from '@tanstack/react-query';

import { itemQueries } from '@/services/item';

import { AlertDialog, Button, toast, useOverlayState } from '@/shared/ui';

interface Props {
  itemId: string;
  containerId: string;
  itemName: string;
  onDeleted?: () => void;
}

export function ItemDeleteTrigger(props: Props) {
  const { itemId, containerId, itemName, onDeleted } = props;
  const state = useOverlayState();

  const { mutateAsync: deleteItem, isPending: isDeleting } = useMutation(
    itemQueries.delete(),
  );

  const handleDelete = async () => {
    try {
      await deleteItem({ id: itemId, containerId });
      state.close();
      onDeleted?.();
    } catch {
      toast.danger('Не удалось удалить вещь');
    }
  };

  return (
    <>
      <button
        type='button'
        aria-label='Удалить вещь'
        className='flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-secondary hover:text-danger'
        onClick={state.open}
      >
        <Trash2 size={16} />
      </button>

      <AlertDialog.Root isOpen={state.isOpen} onOpenChange={state.setOpen}>
        <AlertDialog.Backdrop>
          <AlertDialog.Container>
            <AlertDialog.Dialog>
              <div className='flex items-center gap-3'>
                <AlertDialog.Icon />
                <AlertDialog.Header className='mb-0'>
                  <AlertDialog.Heading>
                    Удалить «{itemName}»?
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
    </>
  );
}
