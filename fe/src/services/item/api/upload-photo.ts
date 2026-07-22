import type { components } from '@/kernel/api/schema';
import { apiClient } from '@/shared/api/api-client';

type ItemPhotoResponseDto = components['schemas']['ItemPhotoResponseDto'];

export async function uploadItemPhotoRequest(
  file: File,
): Promise<ItemPhotoResponseDto> {
  const formData = new FormData();
  formData.append('file', file);

  const { data, error } = await apiClient.POST('/api/v1/items/photo', {
    // openapi-fetch пропускает FormData как есть, минуя JSON-сериализацию;
    // сгенерированный тип тела ({file?: string}) этого не отражает
    body: formData as never,
  });

  if (error) throw error;

  return data!;
}
