import { apiClient } from '@/shared/api/api-client';

export async function meRequest() {
  const { data, error } = await apiClient.GET('/api/v1/user/me');

  if (error) throw error;

  return data!;
}
