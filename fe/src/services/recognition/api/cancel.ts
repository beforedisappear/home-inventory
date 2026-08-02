import type { components } from '@/kernel/api/schema';
import { apiClient } from '@/shared/api/api-client';

type RecognitionResponseDto = components['schemas']['RecognitionResponseDto'];

export async function cancelRecognitionRequest(
  id: string,
): Promise<RecognitionResponseDto> {
  const { data, error } = await apiClient.DELETE(
    '/api/v1/recognitions/{id}',
    { params: { path: { id } } },
  );

  if (error) throw error;

  return data!;
}
