import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, Outlet, useNavigate } from '@tanstack/react-router';

import { sessionQueries, useUnauthenticatedRedirect } from '@/services/session';

import { PROJECT_NAME } from '@/kernel/project';
import { ROUTES } from '@/kernel/routes';

import { Brand, Button, Skeleton, ThemeToggle, Typography } from '@/shared/ui';

// общий скелет всех защищённых страниц: хедер + контентная область под ним
export function ProtectedLayout() {
  const navigate = useNavigate();

  useUnauthenticatedRedirect();

  const { data: user, isPending } = useQuery(sessionQueries.me());
  const logout = useMutation(sessionQueries.logout());

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSettled: () => {
        void navigate({ to: ROUTES.LOGIN });
      },
    });
  };

  return (
    <div className='flex min-h-svh flex-col'>
      <header className='flex items-center justify-between border-b border-border px-6 py-4'>
        <Link to={ROUTES.HOME}>
          <Brand title={PROJECT_NAME} />
        </Link>

        <div className='flex items-center gap-3'>
          <Link to={ROUTES.PROFILE} className='hidden sm:inline'>
            {isPending ? (
              <Skeleton className='h-4 w-32' />
            ) : (
              <Typography type='body-sm' color='muted'>
                {user?.email}
              </Typography>
            )}
          </Link>
          <ThemeToggle />

          <Button
            type='button'
            isDisabled={logout.isPending}
            onPress={handleLogout}
          >
            Выйти
          </Button>
        </div>
      </header>

      <main className='flex flex-1 flex-col'>
        <Outlet />
      </main>
    </div>
  );
}
