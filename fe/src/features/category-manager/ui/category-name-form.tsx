import { useState } from 'react';
import { Input, TextField } from '@heroui/react';

import { Button, ErrorMessage, Spinner } from '@/shared/ui';

interface Props {
  initialName: string;
  submitLabel: string;
  onSave: (name: string) => Promise<void>;
  onClose: () => void;
}

// один попап для создания и переименования — отличаются только initialName/submitLabel
export function CategoryNameForm(props: Props) {
  const { initialName, submitLabel, onSave, onClose } = props;
  const [name, setName] = useState(initialName);
  const [isSaving, setIsSaving] = useState(false);

  const trimmed = name.trim();
  const error =
    trimmed === ''
      ? 'Укажите название'
      : trimmed.length > 128
        ? 'Слишком длинное название'
        : null;

  const handleSave = async () => {
    if (error) return;

    setIsSaving(true);
    try {
      await onSave(trimmed);
      onClose();
    } catch {
      // тост уже показан вызывающей стороной — попап остаётся открытым для повтора
    } finally {
      setIsSaving(false);
    }
  };

  return (
    <div className='flex w-64 flex-col gap-3'>
      <TextField
        value={name}
        onChange={setName}
        isInvalid={Boolean(error)}
        aria-label='Название категории'
      >
        <Input placeholder='Название' />
      </TextField>

      {error && <ErrorMessage>{error}</ErrorMessage>}

      <div className='flex justify-end gap-2'>
        <Button type='button' variant='ghost' size='sm' onPress={onClose}>
          Отмена
        </Button>
        <Button
          type='button'
          size='sm'
          isDisabled={Boolean(error) || isSaving}
          onPress={() => void handleSave()}
        >
          {isSaving ? <Spinner /> : submitLabel}
        </Button>
      </div>
    </div>
  );
}
