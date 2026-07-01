import { useState } from 'react';

import { useForm } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';

import { sessionQueries } from '@/services/session';

import { toast } from '@/shared/ui';

import { authSchema, emailSchema } from './schemas';

type Step = 'email' | 'code';

// вся логика двухшаговой формы входа: стейт шага, мутации, валидация, сабмит
export function useLoginForm() {
  const [step, setStep] = useState<Step>('email');

  const navigate = useNavigate();
  const { mutateAsync: sendCode } = useMutation(sessionQueries.sendCode());
  const { mutateAsync: authenticate } = useMutation(
    sessionQueries.authenticate(),
  );

  // одна форма на оба шага: email хранится в стейте формы, ветвимся по step
  const form = useForm({
    defaultValues: { email: '', code: '' },
    validators: { onSubmit: step === 'email' ? emailSchema : authSchema },
    onSubmit: async ({ value }) => {
      if (step === 'email') {
        try {
          await sendCode({ email: value.email });
          toast.success('Код отправлен на почту');
          setStep('code');
        } catch {
          toast.danger('Не удалось отправить код');
        }

        return;
      }

      try {
        await authenticate({
          email: value.email,
          code: value.code,
        });
        void navigate({ to: '/' });
      } catch {
        toast.danger('Неверный код');
      }
    },
  });

  return { form, step };
}
