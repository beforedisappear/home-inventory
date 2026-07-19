import type { components } from '@/kernel/api/schema';
import { apiClient } from '@/shared/api/api-client';

type ItemResponseDto = components['schemas']['ItemResponseDto'];

export async function findItemByIdRequest(id: string): Promise<ItemResponseDto> {
  const { data, error } = await apiClient.GET('/api/v1/items/{id}', {
    params: { path: { id } },
  });

  if (error) throw error;

  return data!;
}
