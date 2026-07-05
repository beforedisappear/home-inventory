import { Link } from '@tanstack/react-router';

import { ROUTES } from '@/kernel/routes';

import { Button, Skeleton, Typography } from '@/shared/ui';

interface Props {
  email?: string;
  isPending: boolean;
  isLoggingOut: boolean;
  onLogout: () => void;
}

export function HeaderDesktopContent(props: Props) {
  return (
    <div className='hidden items-center gap-3 sm:flex'>
      <Link to={ROUTES.PROFILE}>
        {props.isPending ? (
          <Skeleton className='h-4 w-32' />
        ) : (
          <Typography type='body-sm' color='muted'>
            {props.email}
          </Typography>
        )}
      </Link>

      <Button
        type='button'
        isDisabled={props.isLoggingOut}
        onPress={props.onLogout}
      >
        Выйти
      </Button>
    </div>
  );
}
