import { useMutation } from '@tanstack/react-query';

import { categoryQueries } from '@/services/category';

import { toast } from '@/shared/ui';

export function useDeleteCategory() {
  const { mutateAsync } = useMutation(categoryQueries.delete());

  const handleDelete = async (id: string) => {
    try {
      await mutateAsync({ id });
      toast.success('Категория удалена');
    } catch (err) {
      toast.danger('Не удалось удалить категорию');
      throw err;
    }
  };

  return { handleDelete };
}
