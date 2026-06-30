import type { AnyFieldApi } from '@tanstack/react-form';

import {
  ErrorMessage,
  InputOTP,
  Label,
  REGEXP_ONLY_DIGITS,
} from '@heroui/react';

interface FormOtpFieldProps {
  field: AnyFieldApi;
  label: string;
  length: number;
  onComplete?: () => void;
}

// связывает поле TanStack Form с OTP-вводом HeroUI (по цифре на слот)
export function FormOtpField(props: FormOtpFieldProps) {
  const { field, label, length, onComplete } = props;

  const showError =
    field.state.meta.isTouched && field.state.meta.errors.length > 0;

  return (
    <div className='flex flex-col gap-1'>
      <Label>{label}</Label>

      <InputOTP
        maxLength={length}
        pattern={REGEXP_ONLY_DIGITS}
        value={field.state.value}
        onChange={value => field.handleChange(value)}
        onComplete={onComplete}
        onBlur={field.handleBlur}
        isInvalid={showError}
      >
        <InputOTP.Group>
          {Array.from({ length }, (_, index) => (
            <InputOTP.Slot key={index} index={index} />
          ))}
        </InputOTP.Group>
      </InputOTP>

      {showError && (
        <ErrorMessage>{field.state.meta.errors[0]?.message}</ErrorMessage>
      )}
    </div>
  );
}
