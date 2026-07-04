import { useForm } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';

import { userQueries } from '@/services/user';

import { toast } from '@/shared/ui';

import { nameSchema } from './schemas';

interface UseUserProfileFormProps {
  name: string;
}

// форма редактирования имени: одно поле, значение подставляется из текущего me
export function useUserProfileForm(props: UseUserProfileFormProps) {
  const { mutateAsync: updateName } = useMutation(userQueries.updateName());

  const form = useForm({
    defaultValues: { name: props.name },
    validators: { onSubmit: nameSchema },
    onSubmit: async ({ value }) => {
      try {
        await updateName({ name: value.name });
        toast.success('Имя сохранено');
      } catch {
        toast.danger('Не удалось сохранить имя');
      }
    },
  });

  return { form };
}
