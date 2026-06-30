import type { components } from '@/kernel/api/schema';
import { apiClient } from '@/shared/api/api-client';

type LoginDto = components['schemas']['LoginDto'];

export async function sendCodeRequest(dto: LoginDto) {
  const { data, error } = await apiClient.POST('/api/v1/auth/send-code', {
    body: dto,
  });

  if (error) throw error;

  // в схеме нет error-ответов → data типизирован optional, но на 200 он есть
  return data!;
}
