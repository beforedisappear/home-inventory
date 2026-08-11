import type { ReactNode } from 'react';

import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ChevronLeft } from 'lucide-react';

import { itemQueries } from '@/services/item';

import type { components } from '@/kernel/api/schema';
import { ROUTES } from '@/kernel/routes';

import { ErrorState, Skeleton, Spinner, Typography } from '@/shared/ui';

import { ItemEditForm } from './item-edit-form';

type ItemResponseDto = components['schemas']['ItemResponseDto'];

interface Props {
  id: string;
  categorySlot?: ReactNode;
  headerActions?: ReactNode;
  deleteSlot?: (item: ItemResponseDto) => ReactNode;
}

export function Item(props: Props) {
  const { id, categorySlot, headerActions, deleteSlot } = props;

  const {
    data: item,
    isPending,
    isError,
    refetch,
  } = useQuery(itemQueries.byId(id));

  if (isPending) {
    return (
      <>
        <div className='flex items-center justify-between gap-2 border-b border-border pb-4'>
          <Skeleton className='h-4 w-32' />
          <Skeleton className='size-8 rounded-lg' />
        </div>

        <div className='flex flex-1 flex-col items-center justify-center'>
          <Spinner />
        </div>
      </>
    );
  }

  if (isError || !item) {
    return (
      <div className='flex flex-col gap-2 border-b border-border pb-4'>
        <ErrorState onRetry={() => refetch()}>
          Не удалось загрузить вещь
        </ErrorState>
      </div>
    );
  }

  return (
    <>
      <div className='flex items-center justify-between gap-2 border-b border-border pb-4'>
        <Link
          to={ROUTES.CONTAINER_BY_ID}
          params={{ id: item.containerId }}
          className='inline-flex w-fit items-center gap-1'
        >
          <ChevronLeft size={16} />
          <Typography type='body-sm' color='muted'>
            Назад к контейнеру
          </Typography>
        </Link>

        <div className='flex items-center gap-1'>
          {headerActions}
          {deleteSlot?.(item)}
        </div>
      </div>

      <div className='flex w-full flex-col gap-4 rounded-2xl border border-border bg-surface p-4 shadow-xl sm:p-6 md:p-10'>
        <ItemEditForm
          item={item}
          containerId={item.containerId}
          categorySlot={categorySlot}
        />
      </div>
    </>
  );
}
