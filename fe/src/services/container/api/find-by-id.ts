import type { components } from '@/kernel/api/schema';
import { apiClient } from '@/shared/api/api-client';

type ContainerResponseDto = components['schemas']['ContainerResponseDto'];

export async function findContainerByIdRequest(
  id: string,
): Promise<ContainerResponseDto> {
  const { data, error } = await apiClient.GET('/api/v1/containers/{id}', {
    params: { path: { id } },
  });

  if (error) throw error;

  return data!;
}
