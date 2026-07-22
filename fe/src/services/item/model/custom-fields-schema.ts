import { z } from 'zod';

export const CUSTOM_FIELD_TYPES = [
  'string',
  'number',
  'date',
  'boolean',
] as const;

export type CustomFieldType = (typeof CUSTOM_FIELD_TYPES)[number];

export const CUSTOM_FIELD_TYPE_LABELS: Record<CustomFieldType, string> = {
  string: 'Текст',
  number: 'Число',
  date: 'Дата',
  boolean: 'Да/Нет',
};

export interface CustomFieldFormValue {
  key: string;
  type: CustomFieldType;
  value: string;
}

const ISO_DATE_RE = /^\d{4}-\d{2}-\d{2}$/;

// строгий парсер: отбивает невалидные календарные даты вида 2026-06-31
// (зеркалит be/src/api/item/dto/custom-field.dto.ts)
function isValidIsoDate(value: string): boolean {
  if (!ISO_DATE_RE.test(value)) return false;

  const date = new Date(`${value}T00:00:00.000Z`);
  if (Number.isNaN(date.getTime())) return false;

  return date.toISOString().slice(0, 10) === value;
}

export function getCustomFieldRowError(
  row: CustomFieldFormValue,
): string | null {
  switch (row.type) {
    case 'string':
      // зеркалит CUSTOM_FIELD_STRING_MAX = 1024
      return row.value.length > 1024 ? 'Слишком длинное значение' : null;
    case 'number':
      return row.value.trim() === '' || Number.isNaN(Number(row.value))
        ? 'Введите число'
        : null;
    case 'date':
      return isValidIsoDate(row.value) ? null : 'Введите корректную дату';
    case 'boolean':
      return row.value === 'true' || row.value === 'false'
        ? null
        : 'Некорректное значение';
  }
}

const customFieldRowSchema = z
  .object({
    // зеркалит CUSTOM_FIELD_KEY_MAX = 64
    key: z
      .string()
      .min(1, 'Укажите название поля')
      .max(64, 'Слишком длинное название'),
    type: z.enum(CUSTOM_FIELD_TYPES),
    value: z.string(),
  })
  .superRefine((row, ctx) => {
    const error = getCustomFieldRowError(row);
    if (error)
      ctx.addIssue({ code: 'custom', path: ['value'], message: error });
  });

export const customFieldsSchema = z
  .array(customFieldRowSchema)
  // зеркалит CUSTOM_FIELDS_MAX = 20
  .max(20, 'Максимум 20 полей')
  .refine(fields => new Set(fields.map(f => f.key)).size === fields.length, {
    message: 'Названия полей должны быть уникальными',
  });
