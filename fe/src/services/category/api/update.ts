import type { components } from '@/kernel/api/schema';
import { apiClient } from '@/shared/api/api-client';

type UpdateCategoryDto = components['schemas']['UpdateCategoryDto'];
type CategoryResponseDto = components['schemas']['CategoryResponseDto'];

export async function updateCategoryRequest(
  id: string,
  dto: UpdateCategoryDto,
): Promise<CategoryResponseDto> {
  const { data, error } = await apiClient.PATCH('/api/v1/categories/{id}', {
    params: { path: { id } },
    body: dto,
  });

  if (error) throw error;

  return data!;
}
