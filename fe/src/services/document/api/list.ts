import type { components } from '@/kernel/api/schema';
import { apiClient } from '@/shared/api/api-client';

type DocumentResponseDto = components['schemas']['DocumentResponseDto'];

export async function listDocumentsRequest(
  itemId: string,
): Promise<DocumentResponseDto[]> {
  const { data, error } = await apiClient.GET('/api/v1/documents', {
    params: { query: { itemId } },
  });

  if (error) throw error;

  return data!;
}
