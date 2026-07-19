import { useNavigate, useParams } from '@tanstack/react-router';

import { ItemDetails } from '@/features/item';

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
        <ItemDetails id={id} onDeleted={handleDeleted} />
      </div>
    </div>
  );
}
