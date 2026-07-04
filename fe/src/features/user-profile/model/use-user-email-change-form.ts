import { useState } from 'react';

import { useForm } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';

import { userQueries } from '@/services/user';

import { toast } from '@/shared/ui';

import { confirmCodeSchema, newEmailSchema } from './schemas';

type Step = 'email' | 'code';

interface UseUserEmailChangeFormProps {
  onSuccess: () => void;
}

// вся логика двухшаговой смены email: стейт шага, мутации, валидация, сабмит
export function useUserEmailChangeForm(props: UseUserEmailChangeFormProps) {
  const [step, setStep] = useState<Step>('email');

  const { mutateAsync: requestEmailChange } = useMutation(
    userQueries.requestEmailChange(),
  );
  const { mutateAsync: confirmEmailChange } = useMutation(
    userQueries.confirmEmailChange(),
  );

  const form = useForm({
    defaultValues: { newEmail: '', code: '' },
    validators: {
      onSubmit: step === 'email' ? newEmailSchema : confirmCodeSchema,
    },
    onSubmit: async ({ value }) => {
      if (step === 'email') {
        try {
          await requestEmailChange({ newEmail: value.newEmail });
          toast.success('Код отправлен на новую почту');
          setStep('code');
        } catch {
          toast.danger('Не удалось отправить код');
        }

        return;
      }

      try {
        await confirmEmailChange({ code: value.code });
        toast.success('Email изменён');
        props.onSuccess();
      } catch {
        toast.danger('Неверный код');
      }
    },
  });

  return { form, step };
}
