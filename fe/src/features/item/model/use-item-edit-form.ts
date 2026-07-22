import { useForm } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';

import type { components } from '@/kernel/api/schema';

import { itemQueries, toItemDto } from '@/services/item';

import { toast } from '@/shared/ui';

import { itemEditSchema } from './schemas';

type ItemResponseDto = components['schemas']['ItemResponseDto'];

interface UseItemEditFormProps {
  item: ItemResponseDto;
  containerId: string;
}

export function useItemEditForm(props: UseItemEditFormProps) {
  const { item, containerId } = props;

  const { mutateAsync: updateItem } = useMutation(itemQueries.update());

  const form = useForm({
    defaultValues: {
      name: item.name,
      categoryId: item.categoryId ?? '',
      quantity: String(item.quantity),
      description: item.description ?? '',
      photos: item.photos.map(photo => photo.key),
      customFields: item.customFields.map(f => ({
        key: f.key,
        type: f.type,
        value: String(f.value),
      })),
    },
    validators: { onSubmit: itemEditSchema },
    onSubmit: async ({ value }) => {
      try {
        await updateItem({
          id: item.id,
          containerId,
          dto: toItemDto(value, value.categoryId || null),
        });
        toast.success('Вещь обновлена');
      } catch {
        toast.danger('Не удалось сохранить изменения');
      }
    },
  });

  return { form };
}
