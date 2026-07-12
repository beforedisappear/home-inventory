import type { components } from '@/kernel/api/schema';
import { apiClient } from '@/shared/api/api-client';

type ContainerRuleResponseDto =
  components['schemas']['ContainerRuleResponseDto'];

export async function findContainerRuleByIdRequest(
  id: string,
): Promise<ContainerRuleResponseDto> {
  const { data, error } = await apiClient.GET('/api/v1/container-rules/{id}', {
    params: { path: { id } },
  });

  if (error) throw error;

  return data!;
}
