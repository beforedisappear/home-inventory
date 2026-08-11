import { z } from 'zod';

import { DOCUMENT_TYPES } from '@/services/document';

export const documentEditSchema = z.object({
  type: z.enum(DOCUMENT_TYPES),
  name: z.string().max(256, 'Слишком длинное имя'),
  description: z.string().max(2048, 'Слишком длинное описание'),
  warrantyEndsAt: z.string(),
});
