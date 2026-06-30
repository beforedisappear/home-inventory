import type { components } from '@/kernel/api/schema';
import { apiClient } from '@/shared/api/api-client';

type AuthenticateDto = components['schemas']['AuthenticateDto'];

export async function authenticateRequest(dto: AuthenticateDto) {
  const { data, error } = await apiClient.POST('/api/v1/auth/authenticate', {
    body: dto,
  });

  if (error) throw error;

  // в схеме нет error-ответов → data типизирован optional, но на 200 он есть
  return data!;
}
