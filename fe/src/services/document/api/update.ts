import type { components } from '@/kernel/api/schema';
import { apiClient } from '@/shared/api/api-client';

type UpdateDocumentDto = components['schemas']['UpdateDocumentDto'];
type DocumentResponseDto = components['schemas']['DocumentResponseDto'];

export async function updateDocumentRequest(
  id: string,
  dto: UpdateDocumentDto,
): Promise<DocumentResponseDto> {
  const { data, error } = await apiClient.PATCH('/api/v1/documents/{id}', {
    params: { path: { id } },
    body: dto,
  });

  if (error) throw error;

  return data!;
}
