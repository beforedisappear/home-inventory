import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ChevronLeft } from 'lucide-react';

import { containerQueries } from '@/services/container';

import { getContainerKindLabel } from '@/kernel/container/kind-label';
import { ROUTES } from '@/kernel/routes';

import { Chip, ErrorState, Skeleton, Typography } from '@/shared/ui';

import { ContainerName } from './container-name';

interface Props {
  parentId: string;
}

export function ContainerHeader({ parentId }: Props) {
  const {
    data: container,
    isPending,
    isError,
    refetch,
  } = useQuery(containerQueries.byId(parentId));

  const { data: parent } = useQuery({
    ...containerQueries.byId(container?.parentId ?? ''),
    enabled: !!container?.parentId,
  });

  if (isPending) {
    return (
      <div className='flex flex-col gap-2 border-b border-border pb-4'>
        <Skeleton className='h-6 w-24' />
        <Skeleton className='h-8 w-48' />
      </div>
    );
  }

  if (isError || !container) {
    return (
      <div className='flex flex-col gap-2 border-b border-border pb-4'>
        <ErrorState onRetry={() => refetch()}>
          Не удалось загрузить контейнер
        </ErrorState>
        <Link to={ROUTES.HOME} className='inline-flex w-fit items-center gap-1'>
          <ChevronLeft size={16} />
          <Typography type='body-sm' color='muted'>
            На главную
          </Typography>
        </Link>
      </div>
    );
  }

  const kindLabel = getContainerKindLabel(container.kind);

  return (
    <div className='flex flex-col gap-2 border-b border-border pb-4'>
      {container.parentId ? (
        <Link
          to={ROUTES.CONTAINER_BY_ID}
          params={{ id: container.parentId }}
          className='inline-flex w-fit items-center gap-1'
        >
          <ChevronLeft size={16} />
          <Typography type='body-sm' color='muted'>
            {parent?.name ?? 'Назад'}
          </Typography>
        </Link>
      ) : (
        <Link to={ROUTES.HOME} className='inline-flex w-fit items-center gap-1'>
          <ChevronLeft size={16} />
          <Typography type='body-sm' color='muted'>
            На главную
          </Typography>
        </Link>
      )}

      <div className='flex items-center justify-between gap-2'>
        <ContainerName name={container.name} />
        {kindLabel && <Chip size='sm'>{kindLabel}</Chip>}
      </div>
    </div>
  );
}
