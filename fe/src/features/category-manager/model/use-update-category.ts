import { useMutation } from '@tanstack/react-query';

import { categoryQueries } from '@/services/category';

import { toast } from '@/shared/ui';

import { isConflict } from './is-conflict';

export function useUpdateCategory() {
  const { mutateAsync } = useMutation(categoryQueries.update());

  const handleUpdate = async (id: string, name: string) => {
    try {
      await mutateAsync({ id, name });
      toast.success('Категория обновлена');
    } catch (err) {
      toast.danger(
        isConflict(err)
          ? `Категория «${name}» уже существует`
          : 'Не удалось сохранить изменения',
      );
      throw err;
    }
  };

  return { handleUpdate };
}
