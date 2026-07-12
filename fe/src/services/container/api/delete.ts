import { apiClient } from '@/shared/api/api-client';

export async function deleteContainerRequest(id: string): Promise<void> {
  const { error } = await apiClient.DELETE('/api/v1/containers/{id}', {
    params: { path: { id } },
  });

  if (error) throw error;
}
