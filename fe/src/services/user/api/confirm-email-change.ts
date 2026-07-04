import type { components } from '@/kernel/api/schema';
import { apiClient } from '@/shared/api/api-client';

type ConfirmEmailChangeDto = components['schemas']['ConfirmEmailChangeDto'];

export async function confirmEmailChangeRequest(
  dto: ConfirmEmailChangeDto,
) {
  const { data, error } = await apiClient.POST(
    '/api/v1/user/email/confirm-change',
    { body: dto },
  );

  if (error) throw error;

  return data!;
}
