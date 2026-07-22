# Item Custom Fields (+ Photos-in-Create Parity) — Design

## Goal

Let a user attach arbitrary typed key/value custom fields to an item (string/number/date/boolean), editable from both the create-item modal and the item detail page's edit form. While closing this gap, also close a second one noticed mid-design: photos are currently attachable only after an item exists (detail page), not during creation — this spec brings the create modal to parity with the edit form for both photos and custom fields.

## Context

This is sub-project #3 of 3 for extending Items (#1: detail page, #2: photos — `docs/superpowers/specs/2026-07-20-item-photos-design.md`). Photos' spec explicitly deferred create-time photo attachment as out of scope; this spec reverses that, since building custom-fields-in-create right next to it made the asymmetry (fields at create, photos not) visibly awkward.

The backend for custom fields is fully built and unchanged by this sub-project:

- `CustomField = { key: string (1-64 chars), type: 'string'|'number'|'date'|'boolean', value: string|number|boolean }`. `value`'s runtime shape depends on `type`: `string` → string (≤1024 chars), `number` → finite number, `boolean` → boolean, `date` → ISO `YYYY-MM-DD` string (calendar-validated).
- `CreateItemDto`/`UpdateItemDto` both accept `customFields?: CustomFieldDto[]`, max 20 entries (`CUSTOM_FIELDS_MAX`), unique `key`s (`ArrayUnique`). Same replace-wholesale semantics as `photos` — the array submitted is the array stored, no diffing/merging on the backend.
- `ItemResponseDto.customFields` always present (empty array if none set).

The backend for photos (recap from sub-project #2, unchanged): `POST /items/photo` uploads one file, returns `{key, url, mimeType, size}` immediately; `photos?: string[]` on create/update is the array of attached keys, order = display order.

## Scope

**In scope:**

- `customFields` becomes a field on both `itemEditSchema`/`useItemEditForm` and `createItemSchema`/`useCreateItemForm`, submitted with the rest of the form (no auto-save, no separate endpoint — mirrors how `photos` already works in the edit form).
- New component `CustomFieldsField` (`services/item/ui/`): renders the current list of fields as inline rows (key text input, type select, type-appropriate value input), a "+ Добавить поле" button appending an empty row, and a "×" per row to remove it. Fully generic — operates on `{key, type, value}[]` via a tanstack-form `field: AnyFieldApi`, no Item-specific types.
- `photos` becomes a field on `createItemSchema`/`useCreateItemForm` too — the create modal gets the exact same `ItemPhotosField` as the edit form: upload, thumbnail grid, drag-reorder, and the lightbox all come along unmodified, since the component isn't split into optional pieces.
- Relocate `ItemPhotosField` and `ItemPhotoThumbnail` from `features/item/ui/` to `services/item/ui/` so both `features/item` and `features/item-create` can use them without a same-layer cross-import (forbidden per `fe/CLAUDE.md`'s layer rules — services may hold "both logic and view" and sits below features).
- Client-side validation mirroring every backend constraint: max 20 fields, key 1-64 chars, unique keys, per-type value shape (finite number / ISO date / non-empty within length / boolean).

**Out of scope:**

- Any backend changes.
- Any read-only display of custom fields outside the two forms (e.g. item list rows, search/filter by custom field) — not requested, pure YAGNI.

## Architecture

### Component placement: `services/item/ui/`

`fe/CLAUDE.md`'s layer rules forbid same-layer cross-imports between features (`features/item` and `features/item-create` are siblings) and say the fix is to "extract the shared part down into `kernel` or `shared`" — but `services` is also explicitly allowed to hold view code ("Reusable business modules. May hold both logic and view"), and sits directly below `features` in the stack. Both new/relocated components land in `services/item/ui/`:

- **`ItemPhotosField`** (+ thumbnail) is Item-domain code — it calls `itemQueries.uploadPhoto()` and renders `ItemPhotoResponseDto`.
- **`CustomFieldsField`** carries no Item-specific types in its own code (it's a generic `{key, type, value}[]` list editor), but its only consumers are Item's two forms — it isn't reused anywhere outside the Item domain, so per YAGNI it lands next to `ItemPhotosField` in `services/item/ui/` rather than in `shared/ui` on the strength of a genericity nothing currently exercises.

Both are re-exported from `services/item`'s existing barrel next to `itemQueries`, and both features import them from there.

### Value representation for custom fields

All four types are edited as **plain strings in the form's runtime array** — `{key: string; type: CustomFieldType; value: string}[]` — the same "string until submit" convention `quantity` already uses elsewhere in this form. This keeps `CustomFieldsField` simple: it manipulates the whole array via `field.handleChange(arr => ...)` exactly like `ItemPhotosField` does for `photos`, with no nested tanstack-form field paths per row. `boolean` is edited with a `Checkbox` bound to `value === 'true'`, writing back `'true'`/`'false'`; `date` uses a native `<input type="date">` (no date-picker component exists yet in `shared/ui` and building one is out of scope). Conversion to the DTO's actual per-type value (`Number(value)` / `value === 'true'` / pass-through for string and date) happens once, at submit time, in each form's `onSubmit`.

### Validation

One zod schema, `customFieldsSchema`, in `shared/lib/custom-fields-schema.ts` (a validation rule, not a presentational component, so it sits in `lib` next to `cn.ts`/`event-emitter`, not in `ui`) — reused by both forms' `model/schemas.ts`. Each row validated by a `superRefine` that switches on `type` (number must parse as finite, date must match and calendar-validate `YYYY-MM-DD`, string must be ≤1024 chars, boolean must be exactly `'true'`/`'false'`); the array itself capped at 20 entries and checked for duplicate `key`s via a top-level `refine`. This mirrors `CUSTOM_FIELDS_MAX`/`CUSTOM_FIELD_KEY_MAX`/`CUSTOM_FIELD_STRING_MAX` and the backend's `ArrayUnique`/`IsCustomFieldValue` decorators so submissions fail client-side before ever hitting the API.

## Data Layer

```ts
// shared/lib/custom-fields-schema.ts — new file:
export const customFieldsSchema = z.array(customFieldRowSchema).max(20, ...).refine(/* unique keys */);

// features/item/model/schemas.ts AND features/item-create/model/schemas.ts — both gain:
import { customFieldsSchema } from '@/shared/lib/custom-fields-schema';
customFields: customFieldsSchema;

// features/item-create/model/schemas.ts additionally gains (parity with edit):
photos: z.array(z.string());
```

```ts
// use-item-edit-form.ts / use-create-item-form.ts
// defaultValues gain: customFields: item?.customFields.map(f => ({...f, value: String(f.value)})) ?? []
// create form's defaultValues additionally gain: photos: []
// onSubmit payload gains, both forms:
customFields: value.customFields.map(f => ({
  key: f.key,
  type: f.type,
  value:
    f.type === 'number' ? Number(f.value) :
    f.type === 'boolean' ? f.value === 'true' :
    f.value, // string | date passthrough
}))
// create form's onSubmit payload additionally gains: photos: value.photos
```

```ts
// services/item/index.ts — add:
export { CustomFieldsField } from './ui/custom-fields-field';
export { ItemPhotosField } from './ui/item-photos-field';
```

## Component Responsibilities

- **`CustomFieldsField`** (new, `services/item/ui/`): owns the row list, add/remove, per-row type-switch (resets `value` to that type's default), and per-row validation error display. Receives just `field: AnyFieldApi` for the whole `customFields` array — no other props; its code has no Item-specific types, but it lives next to `ItemPhotosField` since Item's forms are its only consumers.
- **`ItemPhotosField`** (relocated, `services/item/ui/`, unchanged behavior): same grid/upload/reorder/delete it already has; now consumed from two features instead of one.
- **`ItemEditForm`**: adds a `form.Field name='customFields'` rendering `<CustomFieldsField>`, alongside its existing `photos` field — both after "Описание", before "Сохранить". Import path for the photos field changes to `@/services/item`.
- **`CreateItemForm`**: adds both `form.Field name='photos'` (`<ItemPhotosField initialPhotos={[]}>`, imported from `@/services/item`) and `form.Field name='customFields'` (`<CustomFieldsField>`), same submit-button gating on upload-in-flight (`useIsMutating({ mutationKey: itemQueries.uploadPhotoKey() })`) that `ItemEditForm` already has.

## Error Handling

Per-row validation errors (bad number/date, duplicate key, 21st field) render inline under the offending row via the existing zod-on-submit convention — no new error-handling pattern. Photo upload failures in the create modal behave exactly as they do today in the edit form (`toast.danger`, failed placeholder removed). No new failure modes are introduced by relocating `ItemPhotosField` — it's a file move, not a behavior change.

## Testing / Verification

`bun run build` + `bun run lint` on the frontend (no backend changes), plus a manual walkthrough covering: create an item with two custom fields (one string, one number) and one photo, confirm all three persist after reload; add a date and a boolean field, confirm correct round-trip after reload; attempt a 21st custom field and confirm it's blocked client-side; attempt a duplicate key and confirm the inline error; edit an existing item's custom fields (add/remove/change type) from the detail page and confirm save; confirm `ItemPhotosField`'s existing drag-reorder/lightbox/delete behavior is unaffected by the relocation.
