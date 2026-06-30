import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';

import { sessionQueries } from '@/services/session';
import { Button, Spinner } from '@/shared/ui';

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
    <div className='flex flex-col gap-4 p-6'>
      <h1 className='text-2xl font-bold'>Home Inventory</h1>
      <p className='text-sm opacity-70'>{user?.email}</p>
      <Button
        type='button'
        isDisabled={logout.isPending}
        onPress={handleLogout}
      >
        Выйти
      </Button>
    </div>
  );
}
