import { ContainerChildren } from './container-children';
import { ContainerHeader } from './container-header';

interface ContainerListProps {
  parentId: string | null;
}

export function ContainerList({ parentId }: ContainerListProps) {
  return (
    <div className='flex flex-1 flex-col gap-6'>
      {parentId && <ContainerHeader parentId={parentId} />}

      <ContainerChildren parentId={parentId} />
    </div>
  );
}
