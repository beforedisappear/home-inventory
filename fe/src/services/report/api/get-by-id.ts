import type { components } from '@/kernel/api/schema';
import { apiClient } from '@/shared/api/api-client';

type ReportResponseDto = components['schemas']['ReportResponseDto'];

export async function getReportByIdRequest(
  id: string,
): Promise<ReportResponseDto> {
  const { data, error } = await apiClient.GET('/api/v1/reports/{id}', {
    params: { path: { id } },
  });

  if (error) throw error;

  return data!;
}
