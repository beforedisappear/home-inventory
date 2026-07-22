import { useForm } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';

import {
  itemQueries,
  toItemDto,
  type CustomFieldFormValue,
} from '@/services/item';

import { toast } from '@/shared/ui';

import { createItemSchema } from './schemas';

interface UseCreateItemFormProps {
  containerId: string;
  onSuccess: () => void;
}

export function useCreateItemForm(props: UseCreateItemFormProps) {
  const { containerId, onSuccess } = props;

  const { mutateAsync: createItem } = useMutation(itemQueries.create());

  const form = useForm({
    defaultValues: {
      name: '',
      categoryId: '',
      quantity: '1',
      description: '',
      photos: [] as string[],
      customFields: [] as CustomFieldFormValue[],
    },
    validators: { onSubmit: createItemSchema },
    onSubmit: async ({ value }) => {
      try {
        await createItem({
          containerId,
          ...toItemDto(value, value.categoryId || undefined),
        });
        toast.success('Вещь добавлена');
        onSuccess();
      } catch {
        toast.danger('Не удалось добавить вещь');
      }
    },
  });

  return { form };
}
