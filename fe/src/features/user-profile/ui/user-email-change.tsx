import { Button, useOverlayState } from '@/shared/ui';

import { UserEmailChangeForm } from './user-email-change-form';
import { UserEmailChangeModal } from './user-email-change-modal';

export function UserEmailChange() {
  const state = useOverlayState();

  return (
    <>
      <Button type='button' variant='ghost' size='sm' onPress={state.open}>
        Изменить email
      </Button>

      <UserEmailChangeModal state={state}>
        <UserEmailChangeForm onSuccess={state.close} />
      </UserEmailChangeModal>
    </>
  );
}
