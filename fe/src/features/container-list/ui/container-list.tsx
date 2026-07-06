import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ChevronRight, PackageOpen } from 'lucide-react';

import { containerQueries } from '@/services/container';

import { getContainerKindIcon } from '@/kernel/container/kind-icon';
import { ROUTES } from '@/kernel/routes';

import { EmptyState, ErrorState, Spinner, Typography } from '@/shared/ui';

interface Props {
  parentId: string | null;
}

export function ContainerList({ parentId }: Props) {
  const { data, isPending, isError, refetch } = useQuery(
    containerQueries.children(parentId),
  );

  if (isPending) {
    return (
      <div className='flex flex-1 flex-col items-center justify-center'>
        <Spinner />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState onRetry={() => refetch()}>
        Не удалось загрузить контейнеры
      </ErrorState>
    );
  }

  if (data.length === 0) {
    return <EmptyState icon={PackageOpen}>Здесь пока пусто</EmptyState>;
  }

  return (
    <ul className='flex flex-col gap-2'>
      {data.map(child => {
        const Icon = getContainerKindIcon(child.kind);

        return (
          <li key={child.id}>
            <Link
              to={ROUTES.CONTAINER_BY_ID}
              params={{ id: child.id }}
              className='flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3 transition-colors hover:bg-surface-secondary'
            >
              <span className='flex min-w-0 items-center gap-3'>
                <Icon size={18} className='shrink-0 text-muted' />
                <Typography truncate>{child.name}</Typography>
              </span>
              <ChevronRight size={16} className='shrink-0 text-muted' />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
