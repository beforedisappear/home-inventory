import type { components } from '@/kernel/api/schema';
import { apiClient } from '@/shared/api/api-client';

type CreateContainerRuleDto = components['schemas']['CreateContainerRuleDto'];
type ContainerRuleResponseDto =
  components['schemas']['ContainerRuleResponseDto'];

export async function createContainerRuleRequest(
  dto: CreateContainerRuleDto,
): Promise<ContainerRuleResponseDto> {
  const { data, error } = await apiClient.POST('/api/v1/container-rules', {
    body: dto,
  });

  if (error) throw error;

  return data!;
}
