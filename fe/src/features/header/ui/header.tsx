import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';

import { sessionQueries } from '@/services/session';

import { PROJECT_NAME } from '@/kernel/project';
import { ROUTES } from '@/kernel/routes';

import { Brand, ThemeToggle } from '@/shared/ui';

import { HeaderDesktopContent } from './header-desktop-content';
import { HeaderMobileContent } from './header-mobile-content';

export function Header() {
  const navigate = useNavigate();

  const { data: user, isPending } = useQuery(sessionQueries.me());

  const { mutateAsync: logout, isPending: isLoggingOut } = useMutation(
    sessionQueries.logout(),
  );

  const handleLogout = () => {
    logout(undefined, {
      onSettled: () => {
        void navigate({ to: ROUTES.LOGIN });
      },
    });
  };

  return (
    <header className='flex items-center justify-between border-b border-border px-6 py-4'>
      <Link to={ROUTES.HOME}>
        <Brand title={PROJECT_NAME} />
      </Link>

      <div className='flex items-center gap-3'>
        <HeaderDesktopContent
          email={user?.email}
          isPending={isPending}
          isLoggingOut={isLoggingOut}
          onLogout={handleLogout}
        />

        <ThemeToggle />

        <HeaderMobileContent
          isLoggingOut={isLoggingOut}
          onLogout={handleLogout}
        />
      </div>
    </header>
  );
}
