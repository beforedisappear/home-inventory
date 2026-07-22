import { z } from 'zod';

import { customFieldsSchema } from '@/services/item';

export const itemEditSchema = z.object({
  name: z.string().min(1, 'Поле обязательно').max(256, 'Слишком длинное имя'),
  categoryId: z.string(),
  quantity: z
    .string()
    .regex(/^\d+$/, 'Введите целое число')
    .refine(v => Number(v) >= 1, 'Минимум 1'),
  description: z.string().max(2048, 'Слишком длинное описание'),
  photos: z.array(z.string()),
  customFields: customFieldsSchema,
});
