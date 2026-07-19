import type { AnyFieldApi } from '@tanstack/react-form';

import { ErrorMessage, Label, TextArea, TextField } from '@heroui/react';

interface FormTextareaFieldProps {
  field: AnyFieldApi;
  label: string;
}

// связывает поле TanStack Form с полем HeroUI: значение, blur, ошибка
export function FormTextareaField(props: FormTextareaFieldProps) {
  const { field, label } = props;

  const showError = field.state.meta.errors.length > 0;

  return (
    <TextField
      className='flex flex-col gap-1'
      value={field.state.value}
      onChange={value => field.handleChange(value)}
      onBlur={field.handleBlur}
      isInvalid={showError}
    >
      <Label>{label}</Label>
      <TextArea />
      {showError && (
        <ErrorMessage>{field.state.meta.errors[0]?.message}</ErrorMessage>
      )}
    </TextField>
  );
}
