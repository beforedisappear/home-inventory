import { apiClient } from '@/shared/api/api-client';

export async function deleteItemRequest(id: string): Promise<void> {
  const { error } = await apiClient.DELETE('/api/v1/items/{id}', {
    params: { path: { id } },
  });

  if (error) throw error;
}
