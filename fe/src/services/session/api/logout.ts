import { apiClient } from '@/shared/api/api-client';
import { tokenStorage } from '@/shared/api/token-storage';

export async function logoutRequest() {
  const refreshToken = tokenStorage.getRefresh();

  if (!refreshToken) return;

  await apiClient.POST('/api/v1/auth/logout', {
    body: { refreshToken },
  });
}
