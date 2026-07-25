import { useNavigate, useParams } from '@tanstack/react-router';

import { CategoryManager } from '@/features/category-manager';
import { Item } from '@/features/item';
import { QrTrigger } from '@/features/qr';

import { itemQueries } from '@/services/item';

import type { components } from '@/kernel/api/schema';
import { ROUTES } from '@/kernel/routes';

type ItemResponseDto = components['schemas']['ItemResponseDto'];

export function ItemByIdPage() {
  const { id } = useParams({ from: '/protected/items/$id' });
  const navigate = useNavigate();

  const handleDeleted = (item: ItemResponseDto) =>
    void navigate({
      to: ROUTES.CONTAINER_BY_ID,
      params: { id: item.containerId },
    });

  return (
    <div className='flex flex-1 flex-col items-center p-4'>
      <div className='flex w-full max-w-2xl flex-1 flex-col gap-6'>
        <Item
          id={id}
          onDeleted={handleDeleted}
          categorySlot={<CategoryManager />}
          headerActions={
            <QrTrigger
              entityId={id}
              qrQueryOptions={itemQueries.qr(id)}
              generateMutationOptions={itemQueries.generateQr()}
            />
          }
        />
      </div>
    </div>
  );
}
