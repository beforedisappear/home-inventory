import { apiClient } from '@/shared/api/api-client';

export async function deleteReportRequest(id: string): Promise<void> {
  const { error } = await apiClient.DELETE('/api/v1/reports/{id}', {
    params: { path: { id } },
  });

  if (error) throw error;
}
