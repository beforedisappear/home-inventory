import { useQuery } from '@tanstack/react-query';
import { Tag } from 'lucide-react';

import { categoryQueries } from '@/services/category';

import { EmptyState, ErrorState, Spinner, Typography } from '@/shared/ui';

import { CategoryRowActions } from './category-row-actions';

export function CategoryManagerList() {
  const { data, isPending, isError, refetch } = useQuery(
    categoryQueries.list(),
  );

  if (isPending) {
    return (
      <div className='flex flex-1 flex-col items-center justify-center py-8'>
        <Spinner />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState onRetry={() => refetch()}>
        Не удалось загрузить категории
      </ErrorState>
    );
  }

  return (
    <div className='flex flex-col gap-3'>
      {data.length === 0 ? (
        <EmptyState icon={Tag}>Категорий пока нет</EmptyState>
      ) : (
        <div className='flex flex-col gap-2'>
          {data.map(category => (
            <div
              key={category.id}
              className='flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-3'
            >
              <Typography truncate className='flex-1'>
                {category.name}
              </Typography>

              <CategoryRowActions
                categoryId={category.id}
                categoryName={category.name}
              />
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
