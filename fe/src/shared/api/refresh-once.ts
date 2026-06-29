import { tokenStorage } from '@/shared/api/token-storage';
import { env } from '@/shared/config/env';

let inFlight: Promise<boolean> | null = null;

async function doRefresh(): Promise<boolean> {
  const refreshToken = tokenStorage.getRefresh();

  if (!refreshToken) return false;

  const res = await fetch(`${env.apiUrl}${env.refreshPath}`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  });

  if (!res.ok) return false;

  const data = (await res.json()) as {
    accessToken: string;
    refreshToken: string;
  };

  tokenStorage.setTokens(data.accessToken, data.refreshToken);

  return true;
}

// single-flight: конкурентные 401 делят один HTTP-refresh, без штампеды
export function refreshOnce(): Promise<boolean> {
  inFlight ??= doRefresh().finally(() => {
    inFlight = null;
  });

  return inFlight;
}
