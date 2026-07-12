import type { components } from '@/kernel/api/schema';
import { apiClient } from '@/shared/api/api-client';

type ContainerRuleResponseDto =
  components['schemas']['ContainerRuleResponseDto'];

export async function findAllContainerRulesRequest(): Promise<
  ContainerRuleResponseDto[]
> {
  const { data, error } = await apiClient.GET('/api/v1/container-rules');

  if (error) throw error;

  return data!;
}
