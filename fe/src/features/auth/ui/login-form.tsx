import { Button, FormOtpField, FormTextField, Spinner } from '@/shared/ui';

import { CODE_LENGTH } from '../model/schemas';
import { useLoginForm } from '../model/use-login-form';
import { LoginFormResend } from './login-form-resend';

export function LoginForm() {
  const { form, step } = useLoginForm();

  return (
    <form
      className='flex flex-col gap-4'
      onSubmit={e => {
        e.preventDefault();
        e.stopPropagation();
        void form.handleSubmit();
      }}
    >
      {step === 'email' ? (
        <form.Field name='email'>
          {field => <FormTextField field={field} label='Email' type='email' />}
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

      <form.Subscribe
        selector={state => ({
          canSubmit: state.canSubmit,
          isSubmitting: state.isSubmitting,
        })}
      >
        {({ canSubmit, isSubmitting }) =>
          step === 'email' ? (
            <Button type='submit' isDisabled={!canSubmit || isSubmitting}>
              {isSubmitting ? <Spinner /> : 'Получить код'}
            </Button>
          ) : (
            // на шаге code сабмит автоматический по заполнению OTP — показываем только прогресс
            isSubmitting && (
              <div className='flex justify-center'>
                <Spinner />
              </div>
            )
          )
        }
      </form.Subscribe>

      {step === 'code' && <LoginFormResend email={form.state.values.email} />}
    </form>
  );
}
