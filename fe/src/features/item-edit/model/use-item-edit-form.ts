import { useForm } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';

import type { components } from '@/kernel/api/schema';

import { itemQueries } from '@/services/item';

import { toast } from '@/shared/ui';

import { itemEditSchema } from './schemas';

type ItemResponseDto = components['schemas']['ItemResponseDto'];

interface UseItemEditFormProps {
  item: ItemResponseDto;
  containerId: string;
  onSuccess: () => void;
}

export function useItemEditForm(props: UseItemEditFormProps) {
  const { item, containerId, onSuccess } = props;

  const { mutateAsync: updateItem } = useMutation(itemQueries.update());

  const form = useForm({
    defaultValues: {
      name: item.name,
      categoryId: item.categoryId ?? '',
      quantity: String(item.quantity),
      description: item.description ?? '',
    },
    validators: { onSubmit: itemEditSchema },
    onSubmit: async ({ value }) => {
      try {
        await updateItem({
          id: item.id,
          containerId,
          dto: {
            name: value.name,
            categoryId: value.categoryId || null,
            quantity: Number(value.quantity),
            description: value.description || undefined,
          },
        });
        toast.success('Вещь обновлена');
        onSuccess();
      } catch {
        toast.danger('Не удалось сохранить изменения');
      }
    },
  });

  return { form };
}
