import { useMutation } from '@tanstack/react-query';

import { categoryQueries } from '@/services/category';

import { toast } from '@/shared/ui';

import { isConflict } from './is-conflict';

export function useCreateCategory() {
  const { mutateAsync } = useMutation(categoryQueries.create());

  const handleCreate = async (name: string) => {
    try {
      await mutateAsync({ name });
      toast.success('Категория создана');
    } catch (err) {
      toast.danger(
        isConflict(err)
          ? `Категория «${name}» уже существует`
          : 'Не удалось создать категорию',
      );
      throw err;
    }
  };

  return { handleCreate };
}
