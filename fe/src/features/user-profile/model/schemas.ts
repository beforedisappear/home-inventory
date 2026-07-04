import { z } from 'zod';

export const nameSchema = z.object({
  name: z.string().min(1, 'Поле обязательно').max(64, 'Слишком длинное имя'),
});

// длина OTP-кода (бэк валидирует @Length(6, 6))
export const CODE_LENGTH = 6;

const newEmail = z.email('Введите корректный email');

// шаг email: код ещё не введён, проверяем только адрес
export const newEmailSchema = z.object({
  newEmail,
  code: z.string(),
});

// шаг code: тот же адрес + обязательный код
export const confirmCodeSchema = z.object({
  newEmail,
  code: z.string().length(CODE_LENGTH, 'Введите код из 6 цифр'),
});
