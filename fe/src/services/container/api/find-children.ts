import type { components } from '@/kernel/api/schema';
import { apiClient } from '@/shared/api/api-client';

type ContainerResponseDto = components['schemas']['ContainerResponseDto'];

export async function findChildrenRequest(
  parentId: string | null,
): Promise<ContainerResponseDto[]> {
  const { data, error } = await apiClient.GET('/api/v1/containers', {
    params: { query: { parentId: parentId ?? undefined } },
  });

  if (error) throw error;

  return data!;
}
