import type { components } from '@/kernel/api/schema';
import { apiClient } from '@/shared/api/api-client';

type ItemQrResponseDto = components['schemas']['ItemQrResponseDto'];

export async function getItemQrRequest(id: string): Promise<ItemQrResponseDto> {
  const { data, error } = await apiClient.GET('/api/v1/items/{id}/qr', {
    params: { path: { id } },
  });

  if (error) throw error;

  return data!;
}
