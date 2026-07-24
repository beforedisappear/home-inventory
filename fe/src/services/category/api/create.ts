import type { components } from '@/kernel/api/schema';
import { apiClient } from '@/shared/api/api-client';

type CreateCategoryDto = components['schemas']['CreateCategoryDto'];
type CategoryResponseDto = components['schemas']['CategoryResponseDto'];

export async function createCategoryRequest(
  dto: CreateCategoryDto,
): Promise<CategoryResponseDto> {
  const { data, error } = await apiClient.POST('/api/v1/categories', {
    body: dto,
  });

  if (error) throw error;

  return data!;
}
