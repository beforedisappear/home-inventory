import type { ReactNode } from 'react';

import { useQuery } from '@tanstack/react-query';
import { Box } from 'lucide-react';

import { categoryQueries } from '@/services/category';
import { itemQueries } from '@/services/item';

import type { components } from '@/kernel/api/schema';

import { Button, Chip, Typography } from '@/shared/ui';

type ItemResponseDto = components['schemas']['ItemResponseDto'];

interface Props {
  containerId: string;
  renderItemActions?: (item: ItemResponseDto) => ReactNode;
}

export function ItemList({ containerId, renderItemActions }: Props) {
  const {
    data: items,
    isPending,
    isError,
    refetch,
  } = useQuery(itemQueries.byContainer(containerId));

  const { data: categories } = useQuery(categoryQueries.list());

  if (isPending) return null;

  if (isError) {
    return (
      <div className='flex items-center justify-between gap-2 rounded-lg border border-dashed border-danger/40 px-4 py-3'>
        <Typography type='body-sm' color='muted'>
          Не удалось загрузить вещи
        </Typography>
        <Button type='button' variant='ghost' size='sm' onPress={() => refetch()}>
          Повторить
        </Button>
      </div>
    );
  }

  const categoryNameById = new Map(
    (categories ?? []).map(category => [category.id, category.name]),
  );

  return (
    <>
      {items.map(item => (
        <div
          key={item.id}
          className='flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-3'
        >
          <span className='flex min-w-0 flex-1 items-center gap-3'>
            <Box size={18} className='shrink-0 text-muted' />
            <Typography truncate>{item.name}</Typography>
            {item.quantity !== 1 && <Chip size='sm'>× {item.quantity}</Chip>}
            {item.categoryId && categoryNameById.has(item.categoryId) && (
              <Chip size='sm'>{categoryNameById.get(item.categoryId)}</Chip>
            )}
          </span>

          {renderItemActions?.(item)}
        </div>
      ))}
    </>
  );
}
