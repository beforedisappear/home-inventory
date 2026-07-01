import { Outlet } from '@tanstack/react-router';

import { useUnauthenticatedRedirect } from '@/services/session';

export function RootLayout() {
  useUnauthenticatedRedirect();

  return (
    <div className='min-h-full'>
      <Outlet />
    </div>
  );
}
