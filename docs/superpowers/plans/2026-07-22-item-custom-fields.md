# Item Custom Fields Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

> **Amendment (post-execution):** During Task 2 execution the placement of `CustomFieldsField` was changed from `shared/ui/` to `services/item/ui/`, alongside `ItemPhotosField` — both exported from `services/item`'s barrel. Reason: despite having no Item-specific types, its only consumers are Item's forms, so per YAGNI it lives with the domain it actually serves rather than in `shared/ui` on the strength of unused genericity. See `docs/superpowers/specs/2026-07-22-item-custom-fields-design.md` for the corrected rationale. Every `shared/ui/custom-fields-field` reference below is superseded by `services/item/ui/custom-fields-field`.

**Goal:** Let a user attach typed custom fields (string/number/date/boolean) to an item, editable from both the create-item modal and the item detail page's edit form — and while at it, bring photo attachment to the create modal too, closing the asymmetry where photos were edit-only.

**Architecture:** A new generic `CustomFieldsField` (`shared/ui/`) manages a `{key, type, value}[]` tanstack-form field the same way `ItemPhotosField` already manages `photos: string[]` — reading/writing the whole array via `field.handleChange`, no nested per-row form fields. `ItemPhotosField` (+ its thumbnail) relocates from `features/item/ui/` to `services/item/ui/` so both `features/item` (edit) and `features/item-create` can use it without a same-layer cross-import (forbidden per `fe/CLAUDE.md`). Both forms' zod schemas and submit handlers gain `customFields`; the create form additionally gains `photos`. No backend changes — `CreateItemDto`/`UpdateItemDto` already accept both fields.

**Tech Stack:** React + TanStack Form/Query + HeroUI + zod — frontend only, no new dependencies.

## Global Constraints

- All commands run from `fe/`: `bun run build`, `bun run lint`.
- Backend custom-field constraints to mirror exactly (unchanged, already shipped): `CUSTOM_FIELD_TYPES = ['string','number','date','boolean']`, `CUSTOM_FIELDS_MAX = 20`, `CUSTOM_FIELD_KEY_MAX = 64`, `CUSTOM_FIELD_STRING_MAX = 1024` (`be/src/api/item/constants/custom-field.ts`, `be/src/api/item/interfaces/custom-field.types.ts`), unique keys per item, `date` = ISO `YYYY-MM-DD` calendar-validated.
- **Known codegen quirk:** `components['schemas']['CustomFieldDto']['value']` in `@/kernel/api/schema` is typed `Record<string, never>` — the backend's `@IsCustomFieldValue()` decorator has no `@ApiProperty` type hint, so swagger/openapi-typescript can't infer a real type. Bridge with an `as never` cast when constructing request DTOs, same pattern already used in `services/item/api/upload-photo.ts` for `FormData`. Reading `.value` back (e.g. `String(f.value)`) needs no cast — `String()` accepts `any`.
- **Layer rule (`fe/CLAUDE.md`):** `services` may hold "both logic and view"; `features`/`pages`/`services` forbid same-layer cross-imports. This is why `ItemPhotosField` moves to `services/item/ui/` rather than `features/item-create` importing it from `features/item`.
- No unit-test runner on the frontend — verification is `bun run build` + `bun run lint` + one manual browser walkthrough per task where relevant (one targeted pass, not exhaustive regression sweeps).
- User-facing copy is in Russian, matching every existing feature.
- Import order is enforced by `@trivago/prettier-plugin-sort-imports` (auto-fixed on commit hook) — write it correctly regardless.
- Toast conventions unchanged (`toast.success`/`toast.danger`).

---

### Task 1: Shared custom-field schema + types

**Files:**
- Create: `fe/src/shared/lib/custom-fields-schema.ts`

**Interfaces:**
- Consumes: `zod` (existing dependency).
- Produces: `CUSTOM_FIELD_TYPES`, `CustomFieldType`, `CUSTOM_FIELD_TYPE_LABELS`, `CustomFieldFormValue` (`{key: string; type: CustomFieldType; value: string}`), `getCustomFieldRowError(row: CustomFieldFormValue): string | null`, `customFieldsSchema` (zod, validates the whole array). Consumed by Task 2 (`CustomFieldsField`) and Tasks 4/5 (`itemEditSchema`/`createItemSchema`).

- [ ] **Step 1: Write the schema file**

```ts
// fe/src/shared/lib/custom-fields-schema.ts
import { z } from 'zod';

// зеркалит be/src/api/item/interfaces/custom-field.types.ts
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
    if (error) ctx.addIssue({ code: 'custom', path: ['value'], message: error });
  });

export const customFieldsSchema = z
  .array(customFieldRowSchema)
  // зеркалит CUSTOM_FIELDS_MAX = 20
  .max(20, 'Максимум 20 полей')
  .refine(fields => new Set(fields.map(f => f.key)).size === fields.length, {
    message: 'Названия полей должны быть уникальными',
  });
```

- [ ] **Step 2: Typecheck + lint**

Run (from `fe/`): `bun run build && bun run lint`
Expected: no errors. Nothing imports this file yet, so this only checks the file's own type-correctness.

- [ ] **Step 3: Commit**

```bash
git add fe/src/shared/lib/custom-fields-schema.ts
git commit -m "feat(fe): custom-field validation schema and types"
```

---

### Task 2: `CustomFieldsField` — shared row-list component

**Files:**
- Create: `fe/src/shared/ui/custom-fields-field.tsx`
- Modify: `fe/src/shared/ui/index.ts`

**Interfaces:**
- Consumes: `CUSTOM_FIELD_TYPES`, `CUSTOM_FIELD_TYPE_LABELS`, `getCustomFieldRowError`, `CustomFieldFormValue` (Task 1); `AnyFieldApi` (`@tanstack/react-form`); `SelectField` (existing, same directory); `Checkbox`, `ErrorMessage`, `Input`, `Label`, `TextField` (`@heroui/react`).
- Produces: `CustomFieldsField({ field: AnyFieldApi })` — renders/edits the whole `customFields` array. No other props. Consumed by Task 4 (`ItemEditForm`) and Task 5 (`CreateItemForm`).

- [ ] **Step 1: Build the component**

```tsx
// fe/src/shared/ui/custom-fields-field.tsx
import type { AnyFieldApi } from '@tanstack/react-form';
import { Checkbox, ErrorMessage, Input, Label, TextField } from '@heroui/react';
import { Plus, X } from 'lucide-react';

import {
  CUSTOM_FIELD_TYPES,
  CUSTOM_FIELD_TYPE_LABELS,
  getCustomFieldRowError,
  type CustomFieldFormValue,
} from '@/shared/lib/custom-fields-schema';

import { SelectField } from './select-field';

interface Props {
  field: AnyFieldApi;
}

const TYPE_OPTIONS = CUSTOM_FIELD_TYPES.map(type => ({
  id: type,
  label: CUSTOM_FIELD_TYPE_LABELS[type],
}));

function defaultValueFor(type: CustomFieldFormValue['type']): string {
  return type === 'boolean' ? 'false' : '';
}

export function CustomFieldsField(props: Props) {
  const { field } = props;

  const rows: CustomFieldFormValue[] = field.state.value;

  const updateRow = (index: number, patch: Partial<CustomFieldFormValue>) => {
    field.handleChange((current: CustomFieldFormValue[]) =>
      current.map((row, i) => (i === index ? { ...row, ...patch } : row)),
    );
  };

  const handleAdd = () => {
    field.handleChange((current: CustomFieldFormValue[]) => [
      ...current,
      { key: '', type: 'string', value: '' },
    ]);
  };

  const handleRemove = (index: number) => {
    field.handleChange((current: CustomFieldFormValue[]) =>
      current.filter((_, i) => i !== index),
    );
  };

  return (
    <div className='flex flex-col gap-2'>
      <Label>Кастомные поля</Label>

      <div className='flex flex-col gap-2'>
        {rows.map((row, index) => {
          const error = getCustomFieldRowError(row);

          return (
            <div
              key={index}
              className='flex flex-col gap-1 rounded-lg border border-border p-2'
            >
              <div className='flex items-center gap-2'>
                <TextField
                  className='flex-1'
                  value={row.key}
                  onChange={value => updateRow(index, { key: value })}
                  aria-label='Название поля'
                >
                  <Input placeholder='Название' />
                </TextField>

                <SelectField
                  value={row.type}
                  onChange={value =>
                    updateRow(index, {
                      type: value as CustomFieldFormValue['type'],
                      value: defaultValueFor(value as CustomFieldFormValue['type']),
                    })
                  }
                  placeholder='Тип'
                  options={TYPE_OPTIONS}
                />

                {row.type === 'boolean' ? (
                  <Checkbox.Root
                    isSelected={row.value === 'true'}
                    onChange={isSelected =>
                      updateRow(index, { value: isSelected ? 'true' : 'false' })
                    }
                  >
                    <Checkbox.Content>
                      <Checkbox.Control>
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                    </Checkbox.Content>
                  </Checkbox.Root>
                ) : (
                  <TextField
                    className='flex-1'
                    type={
                      row.type === 'number'
                        ? 'number'
                        : row.type === 'date'
                          ? 'date'
                          : 'text'
                    }
                    value={row.value}
                    onChange={value => updateRow(index, { value })}
                    isInvalid={Boolean(error)}
                    aria-label='Значение поля'
                  >
                    <Input placeholder='Значение' />
                  </TextField>
                )}

                <button
                  type='button'
                  aria-label='Удалить поле'
                  onClick={() => handleRemove(index)}
                  className='flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:text-danger'
                >
                  <X size={16} />
                </button>
              </div>

              {error && <ErrorMessage>{error}</ErrorMessage>}
            </div>
          );
        })}
      </div>

      <button
        type='button'
        onClick={handleAdd}
        className='flex w-fit items-center gap-1 text-sm text-primary hover:underline'
      >
        <Plus size={16} />
        Добавить поле
      </button>

      {field.state.meta.errors.length > 0 && (
        <ErrorMessage>{field.state.meta.errors[0]?.message}</ErrorMessage>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Add barrel export**

```ts
// fe/src/shared/ui/index.ts — insert alphabetically (after Brand, before EmptyState):
export { CustomFieldsField } from './custom-fields-field';
```

- [ ] **Step 3: Typecheck + lint**

Run (from `fe/`): `bun run build && bun run lint`
Expected: no errors. Not rendered by any form yet — that's Tasks 4/5.

- [ ] **Step 4: Commit**

```bash
git add fe/src/shared/ui/custom-fields-field.tsx fe/src/shared/ui/index.ts
git commit -m "feat(fe): CustomFieldsField shared component"
```

---

### Task 3: Relocate `ItemPhotosField` to `services/item/ui/`

**Files:**
- Move: `fe/src/features/item/ui/item-photos-field.tsx` → `fe/src/services/item/ui/item-photos-field.tsx`
- Move: `fe/src/features/item/ui/item-photos-thumbnail.tsx` → `fe/src/services/item/ui/item-photos-thumbnail.tsx`
- Modify: `fe/src/services/item/index.ts`
- Modify: `fe/src/features/item/ui/item-edit-form.tsx`

**Interfaces:**
- Consumes: nothing new. Both moved files keep every internal import as-is — `item-photos-field.tsx` already imports `itemQueries` from the absolute `@/services/item` and `ItemPhotoThumbnail` from the relative `./item-photos-thumbnail`, both of which stay valid after the move since the two files move together and the absolute alias doesn't care about location.
- Produces: `ItemPhotosField` importable from `@/services/item` (barrel). `ItemPhotoThumbnail` stays an internal, unexported implementation detail of `services/item/ui/` — same visibility it had inside `features/item/ui/`. Consumed by Task 5 (`CreateItemForm`); `ItemEditForm`'s own usage is updated in this task.

- [ ] **Step 1: Move the two files**

```bash
mkdir -p fe/src/services/item/ui
git mv fe/src/features/item/ui/item-photos-field.tsx fe/src/services/item/ui/item-photos-field.tsx
git mv fe/src/features/item/ui/item-photos-thumbnail.tsx fe/src/services/item/ui/item-photos-thumbnail.tsx
```

Expected: both files now live under `fe/src/services/item/ui/`, content byte-for-byte unchanged.

- [ ] **Step 2: Export `ItemPhotosField` from the `services/item` barrel**

```ts
// fe/src/services/item/index.ts
export { itemQueries } from './api/item.queries';
export { ItemPhotosField } from './ui/item-photos-field';
```

- [ ] **Step 3: Update `ItemEditForm`'s import**

```tsx
// fe/src/features/item/ui/item-edit-form.tsx
// before:
// import { categoryQueries } from '@/services/category';
// import { itemQueries } from '@/services/item';
// ...
// import { ItemPhotosField } from './item-photos-field';

// after:
import { categoryQueries } from '@/services/category';
import { ItemPhotosField, itemQueries } from '@/services/item';
```

Remove the old `import { ItemPhotosField } from './item-photos-field';` line entirely — the rest of the file (JSX, other imports) is unchanged in this step.

- [ ] **Step 4: Typecheck + lint**

Run (from `fe/`): `bun run build && bun run lint`
Expected: no errors.

- [ ] **Step 5: Manual regression check**

Open an existing item's detail page. Confirm the photo grid still renders, upload still works, drag-to-reorder still works, and clicking a thumbnail still opens the lightbox — this is a pure file move, so this is a quick smoke check, not a full re-verification (Task 6 covers the full walkthrough).

- [ ] **Step 6: Commit**

```bash
git add fe/src/services/item/ui/item-photos-field.tsx fe/src/services/item/ui/item-photos-thumbnail.tsx fe/src/services/item/index.ts fe/src/features/item/ui/item-edit-form.tsx
git commit -m "refactor(fe): move ItemPhotosField into services/item/ui"
```

---

### Task 4: Wire `customFields` into the edit form

**Files:**
- Modify: `fe/src/features/item/model/schemas.ts`
- Modify: `fe/src/features/item/model/use-item-edit-form.ts`
- Modify: `fe/src/features/item/ui/item-edit-form.tsx`

**Interfaces:**
- Consumes: `customFieldsSchema` (Task 1), `CustomFieldsField` (Task 2).
- Produces: `itemEditSchema` gains `customFields: customFieldsSchema`; `useItemEditForm`'s form gains a `customFields` field (default from `item.customFields`, submitted with type-converted values); `ItemEditForm` renders `<CustomFieldsField>` after the photos field.

- [ ] **Step 1: Extend `itemEditSchema`**

```ts
// fe/src/features/item/model/schemas.ts
import { z } from 'zod';

import { customFieldsSchema } from '@/shared/lib/custom-fields-schema';

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
```

- [ ] **Step 2: Extend `useItemEditForm`**

```ts
// fe/src/features/item/model/use-item-edit-form.ts
import { useForm } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';

import type { components } from '@/kernel/api/schema';

import { itemQueries } from '@/services/item';

import { toast } from '@/shared/ui';

import { itemEditSchema } from './schemas';

type ItemResponseDto = components['schemas']['ItemResponseDto'];

interface UseItemEditFormProps {
  item: ItemResponseDto;
  containerId: string;
}

export function useItemEditForm(props: UseItemEditFormProps) {
  const { item, containerId } = props;

  const { mutateAsync: updateItem } = useMutation(itemQueries.update());

  const form = useForm({
    defaultValues: {
      name: item.name,
      categoryId: item.categoryId ?? '',
      quantity: String(item.quantity),
      description: item.description ?? '',
      photos: item.photos.map(photo => photo.key),
      customFields: item.customFields.map(f => ({
        key: f.key,
        type: f.type,
        value: String(f.value),
      })),
    },
    validators: { onSubmit: itemEditSchema },
    onSubmit: async ({ value }) => {
      try {
        await updateItem({
          id: item.id,
          containerId,
          dto: {
            name: value.name,
            categoryId: value.categoryId || null,
            quantity: Number(value.quantity),
            description: value.description || undefined,
            photos: value.photos,
            customFields: value.customFields.map(f => ({
              key: f.key,
              type: f.type,
              value: (
                f.type === 'number'
                  ? Number(f.value)
                  : f.type === 'boolean'
                    ? f.value === 'true'
                    : f.value
              ) as never, // openapi-codegen мистипизирует CustomFieldDto.value как Record<string, never> — см. Global Constraints
            })),
          },
        });
        toast.success('Вещь обновлена');
      } catch {
        toast.danger('Не удалось сохранить изменения');
      }
    },
  });

  return { form };
}
```

(only `customFields` in `defaultValues` and in the `updateItem` payload are new)

- [ ] **Step 3: Render the field in `ItemEditForm`**

```tsx
// fe/src/features/item/ui/item-edit-form.tsx
import { useIsMutating, useQuery } from '@tanstack/react-query';

import { categoryQueries } from '@/services/category';
import { ItemPhotosField, itemQueries } from '@/services/item';

import type { components } from '@/kernel/api/schema';

import {
  Button,
  CustomFieldsField,
  FormTextareaField,
  FormTextField,
  SelectField,
  Spinner,
} from '@/shared/ui';

import { useItemEditForm } from '../model/use-item-edit-form';

type ItemResponseDto = components['schemas']['ItemResponseDto'];

interface Props {
  item: ItemResponseDto;
  containerId: string;
}

export function ItemEditForm({ item, containerId }: Props) {
  const { form } = useItemEditForm({ item, containerId });

  const { data: categories } = useQuery(categoryQueries.list());
  const uploadingCount = useIsMutating({
    mutationKey: itemQueries.uploadPhotoKey(),
  });

  return (
    <form
      className='flex flex-col gap-4'
      onSubmit={e => {
        e.preventDefault();
        e.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <form.Field name='name'>
        {field => <FormTextField field={field} label='Название' />}
      </form.Field>

      <form.Field name='categoryId'>
        {field => (
          <SelectField
            label='Категория'
            placeholder='Выберите категорию'
            value={field.state.value}
            onChange={field.handleChange}
            options={(categories ?? []).map(category => ({
              id: category.id,
              label: category.name,
            }))}
            noneOption={{ id: 'none', label: 'Без категории' }}
          />
        )}
      </form.Field>

      <form.Field name='quantity'>
        {field => (
          <FormTextField field={field} label='Количество' type='number' />
        )}
      </form.Field>

      <form.Field name='description'>
        {field => <FormTextareaField field={field} label='Описание' />}
      </form.Field>

      <form.Field name='photos'>
        {field => (
          <ItemPhotosField field={field} initialPhotos={item.photos} />
        )}
      </form.Field>

      <form.Field name='customFields'>
        {field => <CustomFieldsField field={field} />}
      </form.Field>

      <form.Subscribe
        selector={s => ({
          canSubmit: s.canSubmit,
          isSubmitting: s.isSubmitting,
        })}
      >
        {({ canSubmit, isSubmitting }) => (
          <Button
            type='submit'
            isDisabled={!canSubmit || isSubmitting || uploadingCount > 0}
            className='w-full'
          >
            {isSubmitting ? <Spinner /> : 'Сохранить'}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
```

(new: `CustomFieldsField` import and the `customFields` `form.Field` block, right after `photos`; everything else unchanged from Task 3)

- [ ] **Step 4: Typecheck + lint**

Run (from `fe/`): `bun run build && bun run lint`
Expected: no errors.

- [ ] **Step 5: Manual check**

Open an existing item's detail page. Confirm a "Кастомные поля" block renders below "Фото". Click "Добавить поле" — a row appears (Название / Тип select / Значение). Leave type as "Текст", type a name and a value. Add a second row, switch its type to "Число", type a non-numeric value — confirm an inline red error appears under that row; fix it to a number. Add a third row of type "Дата", pick a date via the native date picker. Add a fourth of type "Да/Нет", toggle the checkbox. Click "Сохранить" — confirm success toast, then reload the page and confirm all four rows reappear with the same key/type/value. Add a fifth row with the same key as an existing one and try to save — confirm an inline error about duplicate names. Remove a row via its "×" and confirm it disappears immediately (client-side) and stays gone after save+reload.

- [ ] **Step 6: Commit**

```bash
git add fe/src/features/item/model/schemas.ts fe/src/features/item/model/use-item-edit-form.ts fe/src/features/item/ui/item-edit-form.tsx
git commit -m "feat(fe): custom fields in item edit form"
```

---

### Task 5: Wire `customFields` + `photos` into the create form

**Files:**
- Modify: `fe/src/features/item-create/model/schemas.ts`
- Modify: `fe/src/features/item-create/model/use-create-item-form.ts`
- Modify: `fe/src/features/item-create/ui/create-item-form.tsx`

**Interfaces:**
- Consumes: `customFieldsSchema`, `CustomFieldFormValue` (Task 1), `CustomFieldsField` (Task 2), `ItemPhotosField`, `itemQueries.uploadPhotoKey()` (Task 3 / existing).
- Produces: `createItemSchema` gains `photos`/`customFields`; `useCreateItemForm`'s form gains both fields; `CreateItemForm` renders `ItemPhotosField`/`CustomFieldsField` and gates its submit button on upload-in-flight, matching `ItemEditForm`.

- [ ] **Step 1: Extend `createItemSchema`**

```ts
// fe/src/features/item-create/model/schemas.ts
import { z } from 'zod';

import { customFieldsSchema } from '@/shared/lib/custom-fields-schema';

export const createItemSchema = z.object({
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
```

- [ ] **Step 2: Extend `useCreateItemForm`**

```ts
// fe/src/features/item-create/model/use-create-item-form.ts
import { useForm } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';

import { itemQueries } from '@/services/item';

import type { CustomFieldFormValue } from '@/shared/lib/custom-fields-schema';
import { toast } from '@/shared/ui';

import { createItemSchema } from './schemas';

interface UseCreateItemFormProps {
  containerId: string;
  onSuccess: () => void;
}

export function useCreateItemForm(props: UseCreateItemFormProps) {
  const { containerId, onSuccess } = props;

  const { mutateAsync: createItem } = useMutation(itemQueries.create());

  const form = useForm({
    defaultValues: {
      name: '',
      categoryId: '',
      quantity: '1',
      description: '',
      photos: [] as string[],
      customFields: [] as CustomFieldFormValue[],
    },
    validators: { onSubmit: createItemSchema },
    onSubmit: async ({ value }) => {
      try {
        await createItem({
          containerId,
          name: value.name,
          categoryId: value.categoryId || undefined,
          quantity: Number(value.quantity),
          description: value.description || undefined,
          photos: value.photos,
          customFields: value.customFields.map(f => ({
            key: f.key,
            type: f.type,
            value: (
              f.type === 'number'
                ? Number(f.value)
                : f.type === 'boolean'
                  ? f.value === 'true'
                  : f.value
            ) as never, // см. use-item-edit-form.ts — тот же codegen-мистайп
          })),
        });
        toast.success('Вещь добавлена');
        onSuccess();
      } catch {
        toast.danger('Не удалось добавить вещь');
      }
    },
  });

  return { form };
}
```

- [ ] **Step 3: Render both fields in `CreateItemForm`, gate submit on uploads**

```tsx
// fe/src/features/item-create/ui/create-item-form.tsx
import { useIsMutating, useQuery } from '@tanstack/react-query';

import { categoryQueries } from '@/services/category';
import { ItemPhotosField, itemQueries } from '@/services/item';

import {
  AdaptiveModal,
  Button,
  CustomFieldsField,
  FormTextareaField,
  FormTextField,
  SelectField,
  Spinner,
} from '@/shared/ui';

import { useCreateItemForm } from '../model/use-create-item-form';

interface Props {
  containerId: string;
  onSuccess: () => void;
}

export function CreateItemForm(props: Props) {
  const { containerId, onSuccess } = props;

  const { form } = useCreateItemForm({ containerId, onSuccess });

  const { data: categories } = useQuery(categoryQueries.list());
  const uploadingCount = useIsMutating({
    mutationKey: itemQueries.uploadPhotoKey(),
  });

  return (
    <form
      className='flex flex-1 flex-col'
      onSubmit={e => {
        e.preventDefault();
        e.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <AdaptiveModal.Body className='flex flex-col gap-4'>
        <form.Field name='name'>
          {field => <FormTextField field={field} label='Название' />}
        </form.Field>

        <form.Field name='categoryId'>
          {field => (
            <SelectField
              label='Категория'
              placeholder='Выберите категорию'
              value={field.state.value}
              onChange={field.handleChange}
              options={(categories ?? []).map(category => ({
                id: category.id,
                label: category.name,
              }))}
              noneOption={{ id: 'none', label: 'Без категории' }}
            />
          )}
        </form.Field>

        <form.Field name='quantity'>
          {field => (
            <FormTextField field={field} label='Количество' type='number' />
          )}
        </form.Field>

        <form.Field name='description'>
          {field => <FormTextareaField field={field} label='Описание' />}
        </form.Field>

        <form.Field name='photos'>
          {field => <ItemPhotosField field={field} initialPhotos={[]} />}
        </form.Field>

        <form.Field name='customFields'>
          {field => <CustomFieldsField field={field} />}
        </form.Field>
      </AdaptiveModal.Body>

      <AdaptiveModal.Footer>
        <form.Subscribe
          selector={s => ({
            canSubmit: s.canSubmit,
            isSubmitting: s.isSubmitting,
          })}
        >
          {({ canSubmit, isSubmitting }) => (
            <Button
              type='submit'
              isDisabled={!canSubmit || isSubmitting || uploadingCount > 0}
            >
              {isSubmitting ? <Spinner /> : 'Добавить'}
            </Button>
          )}
        </form.Subscribe>
      </AdaptiveModal.Footer>
    </form>
  );
}
```

(new: `useIsMutating` import, `uploadingCount`, the `photos`/`customFields` `form.Field` blocks, `ItemPhotosField`/`CustomFieldsField` imports, and `uploadingCount > 0` in the submit's `isDisabled`)

- [ ] **Step 4: Typecheck + lint**

Run (from `fe/`): `bun run build && bun run lint`
Expected: no errors.

- [ ] **Step 5: Manual check**

Open a container, click "Добавить вещь". Confirm the modal now shows a photo grid and a "Кастомные поля" block below "Описание". Upload one photo (confirm the spinner tile then thumbnail, "Добавить" disabled meanwhile). Add one custom field (any type). Fill name, click "Добавить" — confirm success toast and the modal closes. Open the newly created item's detail page and confirm both the photo and the custom field are present.

- [ ] **Step 6: Commit**

```bash
git add fe/src/features/item-create/model/schemas.ts fe/src/features/item-create/model/use-create-item-form.ts fe/src/features/item-create/ui/create-item-form.tsx
git commit -m "feat(fe): photos and custom fields in item create form"
```

---

### Task 6: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full build + lint**

Run: `cd fe && bun run build && bun run lint`
Expected: no errors.

- [ ] **Step 2: End-to-end manual walkthrough**

Create an item with two custom fields (one string, one number) and one photo — confirm all three persist after reload. Add a date and a boolean field to it from the edit form, save, reload, confirm correct round-trip (date shows the same day, checkbox shows the same state). Attempt a 21st custom field on that item and confirm it's blocked client-side with "Максимум 20 полей". Attempt two fields with the same name and confirm the inline duplicate-name error. Confirm `ItemPhotosField`'s drag-reorder, lightbox, and delete still work unaffected by the Task 3 relocation, in both the edit form and the create modal (the create modal gets the exact same component, lightbox included).

- [ ] **Step 3: Report completion**

Summarize what was built: custom fields (string/number/date/boolean) on both create and edit forms, photos now attachable at creation time, `ItemPhotosField` relocated to `services/item/ui/` per the project's layer rules. Note this closes sub-project #3 of 3 for extending Items (`docs/superpowers/specs/2026-07-22-item-custom-fields-design.md`).
