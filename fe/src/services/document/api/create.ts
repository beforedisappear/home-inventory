import type { components } from '@/kernel/api/schema';
import { apiClient } from '@/shared/api/api-client';

type CreateDocumentDto = components['schemas']['CreateDocumentDto'];
type DocumentResponseDto = components['schemas']['DocumentResponseDto'];

export async function createDocumentRequest(
  dto: CreateDocumentDto,
): Promise<DocumentResponseDto> {
  const { data, error } = await apiClient.POST('/api/v1/documents', {
    body: dto,
  });

  if (error) throw error;

  return data!;
}
