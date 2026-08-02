import type { components } from '@/kernel/api/schema';

import type { CustomFieldFormValue } from './custom-fields-schema';

interface ItemFormValue {
  name: string;
  quantity: string;
  description: string;
  photos: string[];
  customFields: CustomFieldFormValue[];
}

type CustomFieldDto = components['schemas']['CustomFieldDto'];

// openapi-codegen мистипизирует CustomFieldDto.value как Record<string, never> —
// на деле бэк принимает string/number/boolean в зависимости от type (см. be/src/api/item/dto/custom-field.dto.ts)
function toCustomFieldsDto(fields: CustomFieldFormValue[]): CustomFieldDto[] {
  return fields.map(f => ({
    key: f.key,
    type: f.type,
    value: (
      f.type === 'number'
        ? Number(f.value)
        : f.type === 'boolean'
          ? f.value === 'true'
          : f.value
    ) as never,
  }));
}

// обратное направление: CustomFieldDto[] (из RecognitionDraftDto) → форма.
// value рантайм-типизирован как string/number/boolean (см. комментарий выше
// про мистайпинг openapi-codegen) — String() корректно приводит любой из них
// к строковому виду, который ждёт CustomFieldsField (включая 'true'/'false')
export function fromCustomFieldsDto(
  fields: CustomFieldDto[],
): CustomFieldFormValue[] {
  return fields.map(f => ({
    key: f.key,
    type: f.type,
    value: String(f.value),
  }));
}

// categoryId — отдельный аргумент, а не поле ItemFormValue: create шлёт `undefined`
// при отсутствии, update — `null` (явный сброс), это решает вызывающий код
export function toItemDto<C extends string | null | undefined>(
  value: ItemFormValue,
  categoryId: C,
) {
  return {
    name: value.name,
    categoryId,
    quantity: Number(value.quantity),
    description: value.description || undefined,
    photos: value.photos,
    customFields: toCustomFieldsDto(value.customFields),
  };
}
