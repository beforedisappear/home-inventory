import { useEffect, useState } from 'react';

import { useMutation } from '@tanstack/react-query';

import { sessionQueries } from '@/services/session';

import { Button, toast } from '@/shared/ui';

const COOLDOWN_SEC = 30;

interface ResendCodeProps {
  email: string;
}

// повторная отправка кода с кулдауном, чтобы не спамить рассылку
export function LoginFormResend(props: ResendCodeProps) {
  const { email } = props;

  const [left, setLeft] = useState(COOLDOWN_SEC);
  const { mutateAsync: sendCode, isPending } = useMutation(
    sessionQueries.sendCode(),
  );

  useEffect(() => {
    if (left <= 0) return;

    const id = setTimeout(() => setLeft(left - 1), 1000);

    return () => clearTimeout(id);
  }, [left]);

  const handleResend = async () => {
    try {
      await sendCode({ email });
      toast.success('Код отправлен повторно');
      setLeft(COOLDOWN_SEC);
    } catch {
      toast.danger('Не удалось отправить код');
    }
  };

  return (
    <Button
      type='button'
      isDisabled={left > 0 || isPending}
      variant='ghost'
      onPress={handleResend}
      className='w-full'
    >
      {left > 0
        ? `Отправить код повторно через ${left}с`
        : 'Отправить код повторно'}
    </Button>
  );
}
