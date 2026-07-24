import { useState } from 'react';

import { Button, Spinner, Typography } from '@/shared/ui';

interface Props {
  name: string;
  onConfirm: () => Promise<void>;
  onClose: () => void;
}

export function CategoryDeleteConfirm(props: Props) {
  const { name, onConfirm, onClose } = props;
  const [isDeleting, setIsDeleting] = useState(false);

  const handleConfirm = async () => {
    setIsDeleting(true);
    try {
      await onConfirm();
      onClose();
    } catch {
      // тост уже показан вызывающей стороной
    } finally {
      setIsDeleting(false);
    }
  };

  return (
    <div className='flex w-64 flex-col gap-3'>
      <Typography type='body-sm'>
        Удалить «{name}»? Вещи этой категории останутся без категории.
      </Typography>

      <div className='flex justify-end gap-2'>
        <Button type='button' variant='ghost' size='sm' onPress={onClose}>
          Отмена
        </Button>
        <Button
          type='button'
          variant='danger'
          size='sm'
          isDisabled={isDeleting}
          onPress={() => void handleConfirm()}
        >
          {isDeleting ? <Spinner /> : 'Удалить'}
        </Button>
      </div>
    </div>
  );
}
