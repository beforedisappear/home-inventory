import type { components } from '@/kernel/api/schema';
import { apiClient } from '@/shared/api/api-client';

type DocumentFileResponseDto =
  components['schemas']['DocumentFileResponseDto'];

export async function uploadDocumentFileRequest(
  file: File,
): Promise<DocumentFileResponseDto> {
  const formData = new FormData();
  formData.append('file', file);

  const { data, error } = await apiClient.POST('/api/v1/documents/file', {
    // openapi-fetch пропускает FormData как есть, минуя JSON-сериализацию;
    // сгенерированный тип тела ({file?: string}) этого не отражает
    body: formData as never,
  });

  if (error) throw error;

  return data!;
}
