import {
  AdaptiveModal,
  Button,
  FormOtpField,
  FormTextField,
  Spinner,
} from '@/shared/ui';

import { CODE_LENGTH } from '../model/schemas';
import { useUserEmailChangeForm } from '../model/use-user-email-change-form';

interface UserEmailChangeFormProps {
  onSuccess: () => void;
}

export function UserEmailChangeForm(props: UserEmailChangeFormProps) {
  const { form, step } = useUserEmailChangeForm({
    onSuccess: props.onSuccess,
  });

  return (
    <form
      className='flex flex-col flex-1'
      onSubmit={e => {
        e.preventDefault();
        e.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <AdaptiveModal.Body className='flex flex-col gap-4'>
        {step === 'email' ? (
          <form.Field name='newEmail'>
            {field => (
              <FormTextField field={field} label='Новый email' type='email' />
            )}
          </form.Field>
        ) : (
          <form.Field name='code'>
            {field => (
              <FormOtpField
                field={field}
                label='Код из письма'
                length={CODE_LENGTH}
                onComplete={() => void form.handleSubmit()}
              />
            )}
          </form.Field>
        )}
      </AdaptiveModal.Body>

      <AdaptiveModal.Footer className='mt-auto'>
        <form.Subscribe
          selector={s => ({
            canSubmit: s.canSubmit,
            isSubmitting: s.isSubmitting,
          })}
        >
          {({ canSubmit, isSubmitting }) => (
            <Button type='submit' isDisabled={!canSubmit || isSubmitting}>
              {isSubmitting ? (
                <Spinner />
              ) : step === 'email' ? (
                'Отправить код'
              ) : (
                'Подтвердить'
              )}
            </Button>
          )}
        </form.Subscribe>
      </AdaptiveModal.Footer>
    </form>
  );
}
