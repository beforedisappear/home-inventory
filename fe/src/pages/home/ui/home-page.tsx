import { ContainerList } from '@/features/container-list';

export function HomePage() {
  return (
    <div className='flex flex-1 flex-col items-center p-4'>
      <div className='flex w-full max-w-2xl flex-1 flex-col gap-6'>
        <ContainerList parentId={null} />
      </div>
    </div>
  );
}
