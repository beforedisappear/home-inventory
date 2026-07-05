import { useParams } from '@tanstack/react-router';

import { ContainerList } from '@/features/container-list';

export function ContainerByIdPage() {
  const { id } = useParams({ from: '/protected/containers/$id' });

  return (
    <div className='flex flex-1 flex-col items-center p-4'>
      <div className='flex w-full max-w-2xl flex-1 flex-col'>
        <ContainerList parentId={id} />
      </div>
    </div>
  );
}
