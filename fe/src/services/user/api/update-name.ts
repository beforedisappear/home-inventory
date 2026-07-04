import type { components } from '@/kernel/api/schema';
import { apiClient } from '@/shared/api/api-client';

type UpdateUserDto = components['schemas']['UpdateUserDto'];

export async function updateNameRequest(dto: UpdateUserDto) {
  const { data, error } = await apiClient.PATCH('/api/v1/user/me', {
    body: dto,
  });

  if (error) throw error;

  return data!;
}
