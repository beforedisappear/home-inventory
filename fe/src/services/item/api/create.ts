import type { components } from '@/kernel/api/schema';
import { apiClient } from '@/shared/api/api-client';

type CreateItemDto = components['schemas']['CreateItemDto'];
type ItemResponseDto = components['schemas']['ItemResponseDto'];

export async function createItemRequest(
  dto: CreateItemDto,
): Promise<ItemResponseDto> {
  const { data, error } = await apiClient.POST('/api/v1/items', {
    body: dto,
  });

  if (error) throw error;

  return data!;
}
