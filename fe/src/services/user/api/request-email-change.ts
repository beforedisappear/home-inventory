import type { components } from '@/kernel/api/schema';
import { apiClient } from '@/shared/api/api-client';

type RequestEmailChangeDto = components['schemas']['RequestEmailChangeDto'];

export async function requestEmailChangeRequest(
  dto: RequestEmailChangeDto,
) {
  const { data, error } = await apiClient.POST(
    '/api/v1/user/email/request-change',
    { body: dto },
  );

  if (error) throw error;

  return data!;
}
