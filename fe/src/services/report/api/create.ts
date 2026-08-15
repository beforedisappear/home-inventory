import type { components } from '@/kernel/api/schema';
import { apiClient } from '@/shared/api/api-client';

type ReportResponseDto = components['schemas']['ReportResponseDto'];

export async function createReportRequest(
  containerId: string,
): Promise<ReportResponseDto> {
  const { data, error } = await apiClient.POST('/api/v1/reports', {
    body: { containerId },
  });

  if (error) throw error;

  return data!;
}
