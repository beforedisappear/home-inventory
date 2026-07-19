import { useNavigate, useParams } from '@tanstack/react-router';

import { ContainerHeader } from '@/features/container';
import { CreateContainer } from '@/features/container-create';
import {
  ContainerDeleteDialog,
  ContainerDeleteTrigger,
} from '@/features/container-delete';
import { ContainerEdit } from '@/features/container-edit';
import { ContainerList } from '@/features/container-list';
import { CreateItem } from '@/features/item-create';
import { ItemDeleteTrigger } from '@/features/item-delete';
import { ItemList } from '@/features/item-list';

import { ROUTES } from '@/kernel/routes';

export function ContainerByIdPage() {
  const { id } = useParams({ from: '/protected/containers/$id' });
  const navigate = useNavigate();

  return (
    <div className='flex flex-1 flex-col items-center p-4'>
      <div className='flex w-full max-w-2xl flex-1 flex-col gap-6'>
        <ContainerHeader
          parentId={id}
          actions={container => {
            const handleNavigate = () =>
              void navigate(
                container.parentId
                  ? {
                      to: ROUTES.CONTAINER_BY_ID,
                      params: { id: container.parentId },
                    }
                  : { to: ROUTES.HOME },
              );

            return (
              <>
                <ContainerEdit
                  containerId={container.id}
                  parentId={container.parentId}
                  name={container.name}
                />
                <CreateContainer parentId={container.id} />
                <ContainerDeleteTrigger
                  containerId={container.id}
                  parentId={container.parentId}
                  containerName={container.name}
                  onDeleted={handleNavigate}
                />
              </>
            );
          }}
        />

        <ContainerList
          parentId={id}
          renderItemActions={child => (
            <ContainerDeleteTrigger
              containerId={child.id}
              parentId={id}
              containerName={child.name}
            />
          )}
        >
          <ItemList
            containerId={id}
            renderItemActions={item => (
              <ItemDeleteTrigger
                itemId={item.id}
                containerId={id}
                itemName={item.name}
              />
            )}
          />
          <CreateItem containerId={id} />
        </ContainerList>
      </div>

      <ContainerDeleteDialog />
    </div>
  );
}
