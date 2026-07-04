import { useQuery } from '@tanstack/react-query';

import { sessionQueries } from '@/services/session';

import { Spinner, Typography } from '@/shared/ui';

import { UserEmailField } from './user-email-field';
import { UserProfileForm } from './user-profile-form';

export function UserProfile() {
  const { data: user, isPending } = useQuery(sessionQueries.me());

  if (isPending) {
    return <Spinner />;
  }

  return (
    <div className='flex flex-col gap-2 w-full max-w-xl min-h-84 rounded-2xl border border-border bg-surface p-10 shadow-xl'>
      <Typography.Heading level={3}>Профиль</Typography.Heading>

      <UserEmailField email={user?.email ?? ''} />

      <UserProfileForm name={user?.name ?? ''} />
    </div>
  );
}
