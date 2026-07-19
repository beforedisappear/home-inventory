import type { components } from '@/kernel/api/schema';
import { apiClient } from '@/shared/api/api-client';

type UpdateItemDto = components['schemas']['UpdateItemDto'];
type ItemResponseDto = components['schemas']['ItemResponseDto'];

export async function updateItemRequest(
  id: string,
  dto: UpdateItemDto,
): Promise<ItemResponseDto> {
  const { data, error } = await apiClient.PATCH('/api/v1/items/{id}', {
    params: { path: { id } },
    body: dto,
  });

  if (error) throw error;

  return data!;
}
