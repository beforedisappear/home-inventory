import type { components } from '@/kernel/api/schema';
import { apiClient } from '@/shared/api/api-client';

type ContainerQrResponseDto = components['schemas']['ContainerQrResponseDto'];

export async function generateContainerQrRequest(
  id: string,
): Promise<ContainerQrResponseDto> {
  const { data, error } = await apiClient.POST(
    '/api/v1/containers/{id}/qr/generate',
    { params: { path: { id } } },
  );

  if (error) throw error;

  return data!;
}
