import { z } from 'zod';

const email = z.email('Введите корректный email');

// длина OTP-кода (бэк валидирует @Length(6, 6))
export const CODE_LENGTH = 6;

// шаг email: код ещё не введён, проверяем только адрес
export const emailSchema = z.object({
  email,
  code: z.string(),
});

// шаг code: тот же адрес + обязательный код
export const authSchema = z.object({
  email,
  code: z.string().length(CODE_LENGTH, 'Введите код из 6 цифр'),
});
