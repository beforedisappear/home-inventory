import { CreateContainer } from '@/features/container-create';
import {
  ContainerDeleteDialog,
  ContainerDeleteTrigger,
} from '@/features/container-delete';
import { ContainerList } from '@/features/container-list';

import { Typography } from '@/shared/ui';

export function HomePage() {
  return (
    <div className='flex flex-1 flex-col items-center p-4'>
      <div className='flex w-full max-w-2xl flex-1 flex-col gap-6'>
        <div className='flex items-center justify-between gap-2 border-b border-border pb-4'>
          <Typography.Heading level={2}>Мои контейнеры</Typography.Heading>
          <CreateContainer parentId={null} />
        </div>

        <ContainerList
          parentId={null}
          renderItemActions={child => (
            <ContainerDeleteTrigger
              containerId={child.id}
              parentId={null}
              containerName={child.name}
            />
          )}
        />
      </div>

      <ContainerDeleteDialog />
    </div>
  );
}
