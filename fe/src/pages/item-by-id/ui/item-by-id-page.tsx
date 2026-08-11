import { useNavigate, useParams } from '@tanstack/react-router';

import { CategoryManager } from '@/features/category-manager';
import { DocumentList } from '@/features/document-list';
import { Item } from '@/features/item';
import { ItemDeleteTrigger } from '@/features/item-delete';
import { QrTrigger } from '@/features/qr';

import { itemQueries } from '@/services/item';

import { ROUTES } from '@/kernel/routes';

export function ItemByIdPage() {
  const { id } = useParams({ from: '/protected/items/$id' });
  const navigate = useNavigate();

  return (
    <div className='flex flex-1 flex-col items-center p-4'>
      <div className='flex w-full max-w-2xl flex-1 flex-col gap-6'>
        <Item
          id={id}
          categorySlot={<CategoryManager />}
          headerActions={
            <QrTrigger
              entityId={id}
              qrQueryOptions={itemQueries.qr(id)}
              generateMutationOptions={itemQueries.generateQr()}
            />
          }
          deleteSlot={item => (
            <ItemDeleteTrigger
              itemId={item.id}
              containerId={item.containerId}
              itemName={item.name}
              onDeleted={() =>
                void navigate({
                  to: ROUTES.CONTAINER_BY_ID,
                  params: { id: item.containerId },
                })
              }
            />
          )}
        />

        <DocumentList itemId={id} />
      </div>
    </div>
  );
}
