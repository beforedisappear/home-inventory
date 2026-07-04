import '@/shared/ui';
import { useOverlayState } from '@/shared/ui';

import { UserEmailChangeForm } from './user-email-change-form';
import { UserEmailChangeModal } from './user-email-change-modal';

export function UserEmailChange() {
  const state = useOverlayState();

  return (
    <UserEmailChangeModal state={state}>
      <UserEmailChangeForm onSuccess={state.close} />
    </UserEmailChangeModal>
  );
}
