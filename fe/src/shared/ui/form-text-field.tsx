import type { AnyFieldApi } from '@tanstack/react-form';

import { ErrorMessage, Input, Label, TextField } from '@heroui/react';

interface FormTextFieldProps {
  field: AnyFieldApi;
  label: string;
  type?: 'text' | 'email';
}

// связывает поле TanStack Form с полем HeroUI: значение, blur, ошибка
export function FormTextField(props: FormTextFieldProps) {
  const { field, label, type = 'text' } = props;

  const showError = field.state.meta.errors.length > 0;

  return (
    <TextField
      className='flex flex-col gap-1'
      type={type}
      value={field.state.value}
      onChange={value => field.handleChange(value)}
      onBlur={field.handleBlur}
      isInvalid={showError}
    >
      <Label>{label}</Label>
      <Input />
      {showError && (
        <ErrorMessage>{field.state.meta.errors[0]?.message}</ErrorMessage>
      )}
    </TextField>
  );
}
