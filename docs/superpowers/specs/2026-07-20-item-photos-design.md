# Item Photos — Design

## Goal

Let a user attach photos to an item from its detail page: upload, view full-size, reorder, and remove — all saved together with the rest of the item form via the existing "Сохранить" button.

## Context

Sub-project #1 (`docs/superpowers/specs/2026-07-19-item-detail-page-design.md`) shipped the `/items/$id` page. Its implementation ended up diverging from that original spec during execution: editing is not modal-based — `features/item/ui/item-edit-form.tsx` renders inline and unconditionally inside `Item`, wrapped in a card (`rounded-2xl border border-border bg-surface p-10 shadow-xl`), with pre-filled inputs doubling as the read view. This spec builds on that actual current shape, not the original modal-based one.

The backend for photos is fully built and unchanged by this sub-project:

- `POST /items/photo` (multipart, field `file`, mime whitelist `image/jpeg|png|webp`, max 10MB) uploads one file immediately, returns `ItemPhotoResponseDto { key, url, mimeType, size }`. Compression happens asynchronously in the background and overwrites the same S3 key in place — the returned `url` is valid immediately and never changes.
- Attaching/detaching/reordering photos on an item is not a separate endpoint — `CreateItemDto`/`UpdateItemDto` both accept `photos?: string[]` (an array of storage keys). `ItemService` diffs the submitted array against the item's current photos: keys no longer present get deleted from S3, new keys get validated (must belong to the calling user, must exist in storage) and merged in. Array order is display order — reordering is just resubmitting a differently-ordered array.
- No photo-count limit exists server-side.

This is sub-project #2 of 3 for extending Items (#3 is Custom Fields, still future).

## Scope

**In scope:**

- `photos` becomes a field on the existing `ItemEditForm` (tanstack-form), submitted together with name/category/quantity/description via the one existing "Сохранить" button — not auto-saved per action.
- New block inside the existing form card (after "Описание", before "Сохранить"): a grid of photo thumbnails + an "add" tile.
- Upload: file picker (multi-select), immediately `POST`s each file, shows a per-thumbnail loading state while in flight, disables "Сохранить" while any upload is in flight.
- Delete: a "×" on each thumbnail removes its key from the form's `photos` array (client-side only until submit).
- Reorder: drag-and-drop within the grid, via a newly-added `@dnd-kit` dependency.
- Full-size viewing: a lightbox opens on thumbnail click (not on the delete button), with prev/next navigation and Esc/backdrop close.
- Upload failures (rejected mime, network error, oversized file) surface via the existing `toast.danger` convention.

**Out of scope (this sub-project):**

- Attaching photos during item **creation** (`create-item-form.tsx` / the "Добавить вещь" modal) — photos are only manageable from an already-created item's detail page.
- Auto-save on add/remove/reorder — explicitly deferred to the common form submit (user's choice; see Known Limitation below).
- Custom fields (sub-project #3).
- Any backend changes — the existing photo endpoints already cover everything this feature needs.

**Known limitation (accepted trade-off):** because attaching photos is deferred to form submit, a file the user picks is durably uploaded to S3 the moment it's picked — if the user navigates away without hitting "Сохранить", that object is never attached to the item and is never cleaned up (no orphan-TTL job exists for item photos, unlike QR/report objects). This is a direct consequence of the chosen save model, not a bug to fix here.

## Architecture

### Why `photos` lives in the same tanstack-form, not its own mutation

The task board already established the pattern of one form covering the whole editable surface of an item (no per-field auto-save, no separate edit mode). Splitting photos into their own auto-saving mutation would introduce a second persistence model on the same page for no benefit the user asked for — they explicitly chose the common submit button. The only immediate side-effect that _can't_ be deferred is the raw file upload itself (`POST /items/photo` needs to happen to obtain a `key` at all), which is why upload-on-select + attach-on-submit is the shape: the upload is unavoidable, but attaching the key to the item is not.

### Two pieces of state, not one

The form field `photos` only ever holds `string[]` (keys) — that's exactly the shape `UpdateItemDto.photos` needs and exactly what tanstack-form needs to track for submission/dirty-checking. But rendering a thumbnail needs `url`/`mimeType`/`size` too, which the form field doesn't carry. `ItemPhotosField` therefore keeps a second, local, non-form `Record<string, ItemPhotoResponseDto>` map (seeded from `item.photos` on mount, appended to as uploads complete) purely for rendering. The form field stays the single source of truth for _which keys are attached and in what order_; the map is a derived rendering cache keyed off those same keys.

### Why the lightbox isn't a shared component

`AdaptiveModal`/`Modal` in `shared/ui` render with padding, a header slot, and (on mobile) drawer semantics — all wrong for a full-bleed image viewer with prev/next chrome. Nothing else in the app needs a lightbox yet, so `PhotoLightbox` stays local to `features/item/ui/`. If a second consumer shows up later (e.g. document previews), promoting it to `shared/ui` is a one-file move — not designing for that now.

### New dependency: `@dnd-kit`

No drag-and-drop library exists in the project yet. Adds `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities` — the standard, actively-maintained, accessible choice for sortable grids in React (successor to the now-archived `react-beautiful-dnd`).

### Upload wire format

`POST /api/v1/items/photo`'s generated operation type declares `requestBody.content['multipart/form-data'] = { file?: string }` (OpenAPI's representation of a binary field), but at runtime `openapi-fetch`'s default body serializer special-cases `FormData` — `if (body instanceof FormData) return body` — and skips JSON serialization entirely, letting the browser set the multipart `Content-Type` boundary itself. The service function builds a real `FormData` and passes it as `body`, with a type assertion (and a one-line comment explaining why) to bridge the generated `{file?: string}` type against the `FormData` the runtime actually wants.

## Data Layer

```ts
// services/item/api/upload-photo.ts
export async function uploadItemPhotoRequest(
  file: File,
): Promise<ItemPhotoResponseDto> {
  const formData = new FormData();
  formData.append("file", file);

  const { data, error } = await apiClient.POST("/api/v1/items/photo", {
    // openapi-fetch's default serializer passes FormData through as-is;
    // the generated `{file?: string}` body type doesn't reflect that.
    body: formData as never,
  });

  if (error) throw error;
  return data!;
}
```

```ts
// services/item/api/item.queries.ts — add:
itemQueries.uploadPhoto(); // mutationOptions({ mutationFn: uploadItemPhotoRequest })
// no cache invalidation — this mutation isn't tied to any query key,
// the returned key only becomes meaningful once it's in a submitted item's `photos` array
```

```ts
// features/item/model/schemas.ts — itemEditSchema gains:
photos: z.array(z.string());
```

```ts
// features/item/model/use-item-edit-form.ts
// defaultValues gains: photos: item.photos.map(p => p.key)
// onSubmit's updateItem(...) payload gains: photos: value.photos
```

## Component Responsibilities

- **`ItemPhotosField`** (new, `features/item/ui/`): owns the thumbnail grid, the local `photoMeta` render cache, the hidden file `<input multiple>`, the upload mutation calls, drag-and-drop via `@dnd-kit`, and the per-thumbnail delete button. Receives the tanstack-form `field` for `photos` (reads/writes `field.state.value` directly, same pattern as every other field in `ItemEditForm`) and `initialPhotos: ItemResponseDto['photos']` to seed the render cache. Exposes upload-in-flight state upward via `onUploadingChange(count: number)` so the form can gate its submit button.
- **`PhotoLightbox`** (new, `features/item/ui/`): controlled full-screen overlay (`open`, `photos`, `startIndex`, `onClose`) with prev/next and Esc/backdrop-close. Purely presentational — no data fetching or mutation of its own.
- **`ItemEditForm`**: adds a `form.Field name='photos'` rendering `<ItemPhotosField>` after the description field; tracks upload-in-flight count locally to extend the existing submit-disabled condition (`!canSubmit || isSubmitting || uploadingCount > 0`).
- **`Item`**: unchanged — still just fetches the item and renders the header + the (now slightly larger) `ItemEditForm` inside the existing card.

## Error Handling

Upload failures (rejected mime/oversized/network) surface via `toast.danger`, matching every other mutation in the app; the failed thumbnail placeholder is simply removed rather than left in a stuck loading state. Save/delete/reorder failures ride the existing form-submit error handling already in `useItemEditForm` — reordering and removal are pure client-side array edits with no separate failure mode of their own.

## Testing / Verification

`bun run build` + `bun run lint` on the frontend (no backend changes), plus one manual walkthrough on a real item: upload two photos, confirm thumbnails render with real URLs after save; drag to reorder and confirm the new order persists after a reload; delete one and confirm it's gone from both the grid and (after save) storage-backed state; open the lightbox and click through prev/next; attempt an unsupported file type and confirm a toast error with no thumbnail added.
