import { z } from 'zod';

export const containerEditSchema = z.object({
  name: z.string().min(1, 'Поле обязательно').max(128, 'Слишком длинное имя'),
});
