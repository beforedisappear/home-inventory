import { PROJECT_NAME } from '@/kernel/project';

import {
  Brand,
  Button,
  FormOtpField,
  FormTextField,
  Spinner,
  Typography,
} from '@/shared/ui';

import { CODE_LENGTH } from '../model/schemas';
import { useLoginForm } from '../model/use-login-form';
import { LoginFormResend } from './login-form-resend';

export function LoginForm() {
  const { form, step } = useLoginForm();

  return (
    <div className='flex min-h-90 w-full max-w-sm flex-col rounded-2xl border border-border bg-surface p-8 shadow-xl'>
      <Brand title={PROJECT_NAME} />

      <Typography.Heading level={3} className='mt-6'>
        Вход
      </Typography.Heading>
      <Typography.Paragraph size='sm' color='muted' className='mb-6 mt-1'>
        Войдите по коду из письма
      </Typography.Paragraph>

      <form
        className='flex flex-1 flex-col gap-4'
        onSubmit={e => {
          e.preventDefault();
          e.stopPropagation();
          void form.handleSubmit();
        }}
      >
        {step === 'email' ? (
          <form.Field name='email'>
            {field => (
              <FormTextField field={field} label='Email' type='email' />
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

        <div className='flex-1' />

        <form.Subscribe
          selector={state => ({
            canSubmit: state.canSubmit,
            isSubmitting: state.isSubmitting,
          })}
        >
          {({ canSubmit, isSubmitting }) => (
            <Button
              type='submit'
              className='w-full'
              isDisabled={!canSubmit || isSubmitting}
            >
              {isSubmitting ? <Spinner /> : 'Получить код'}
            </Button>
          )}
        </form.Subscribe>

        {step === 'code' && <LoginFormResend email={form.state.values.email} />}
      </form>
    </div>
  );
}
