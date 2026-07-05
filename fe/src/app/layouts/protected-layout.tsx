import { Outlet } from '@tanstack/react-router';

import { useUnauthenticatedRedirect } from '@/services/session';

import { Header } from '@/features/header';

// общий скелет всех защищённых страниц: хедер + контентная область под ним
export function ProtectedLayout() {
  useUnauthenticatedRedirect();

  return (
    <div className='flex min-h-svh flex-col'>
      <Header />

      <main className='flex flex-1 flex-col'>
        <Outlet />
      </main>
    </div>
  );
}
