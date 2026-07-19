import type { components } from '@/kernel/api/schema';
import { apiClient } from '@/shared/api/api-client';

type CategoryResponseDto = components['schemas']['CategoryResponseDto'];

export async function findAllCategoriesRequest(): Promise<
  CategoryResponseDto[]
> {
  const { data, error } = await apiClient.GET('/api/v1/categories');

  if (error) throw error;

  return data!;
}
