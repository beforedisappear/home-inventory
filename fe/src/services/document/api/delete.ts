import { apiClient } from '@/shared/api/api-client';

export async function deleteDocumentRequest(id: string): Promise<void> {
  const { error } = await apiClient.DELETE('/api/v1/documents/{id}', {
    params: { path: { id } },
  });

  if (error) throw error;
}
