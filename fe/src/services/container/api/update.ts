import type { components } from '@/kernel/api/schema';
import { apiClient } from '@/shared/api/api-client';

type UpdateContainerDto = components['schemas']['UpdateContainerDto'];
type ContainerResponseDto = components['schemas']['ContainerResponseDto'];

export async function updateContainerRequest(
  id: string,
  dto: UpdateContainerDto,
): Promise<ContainerResponseDto> {
  const { data, error } = await apiClient.PATCH('/api/v1/containers/{id}', {
    params: { path: { id } },
    body: dto,
  });

  if (error) throw error;

  return data!;
}
