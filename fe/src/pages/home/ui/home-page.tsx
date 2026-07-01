import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';

import { sessionQueries } from '@/services/session';

import { PROJECT_NAME } from '@/kernel/project';

import { Brand, Button, Spinner, ThemeToggle, Typography } from '@/shared/ui';

export function HomePage() {
  const navigate = useNavigate();
  const { data: user, isPending } = useQuery(sessionQueries.me());
  const logout = useMutation(sessionQueries.logout());

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSettled: () => {
        void navigate({ to: '/login' });
      },
    });
  };

  if (isPending) {
    return (
      <div className='flex min-h-svh items-center justify-center'>
        <Spinner />
      </div>
    );
  }

  return (
    <div className='flex min-h-svh flex-col'>
      <header className='flex items-center justify-between border-b border-border px-6 py-4'>
        <Brand title={PROJECT_NAME} />
        <div className='flex items-center gap-3'>
          <Typography type='body-sm' color='muted' className='hidden sm:inline'>
            {user?.email}
          </Typography>
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

      <main className='flex flex-1 items-center justify-center p-4'>
        <div className='w-full max-w-md rounded-2xl border border-border bg-surface p-8'>
          <Typography.Heading level={3}>Home Inventory</Typography.Heading>

          <Typography.Paragraph size='sm' color='muted' className='mt-1'>
            Вы вошли как {user?.email}
          </Typography.Paragraph>
        </div>
      </main>
    </div>
  );
}
