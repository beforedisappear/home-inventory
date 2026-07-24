import { apiClient } from '@/shared/api/api-client';

export async function deleteCategoryRequest(id: string): Promise<void> {
  const { error } = await apiClient.DELETE('/api/v1/categories/{id}', {
    params: { path: { id } },
  });

  if (error) throw error;
}
