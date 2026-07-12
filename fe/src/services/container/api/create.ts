import type { components } from '@/kernel/api/schema';
import { apiClient } from '@/shared/api/api-client';

type CreateContainerDto = components['schemas']['CreateContainerDto'];
type ContainerResponseDto = components['schemas']['ContainerResponseDto'];

export async function createContainerRequest(
  dto: CreateContainerDto,
): Promise<ContainerResponseDto> {
  const { data, error } = await apiClient.POST('/api/v1/containers', {
    body: dto,
  });

  if (error) throw error;

  return data!;
}
