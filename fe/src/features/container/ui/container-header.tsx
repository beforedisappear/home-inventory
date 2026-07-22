import type { ReactNode } from 'react';

import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ChevronLeft } from 'lucide-react';

import { containerQueries } from '@/services/container';

import type { components } from '@/kernel/api/schema';
import { getContainerKindLabel } from '@/kernel/container/kind-label';
import { ROUTES } from '@/kernel/routes';

import { Chip, Skeleton, Typography } from '@/shared/ui';

import { ContainerName } from './container-name';

type ContainerResponseDto = components['schemas']['ContainerResponseDto'];

interface Props {
  parentId: string;
  actions?: (container: ContainerResponseDto) => ReactNode;
}

export function ContainerHeader({ parentId, actions }: Props) {
  const {
    data: container,
    isPending,
    isError,
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
    return null;
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

        <div className='flex shrink-0 items-center gap-2'>
          {kindLabel && <Chip size='sm'>{kindLabel}</Chip>}
          {actions?.(container)}
        </div>
      </div>
    </div>
  );
}
