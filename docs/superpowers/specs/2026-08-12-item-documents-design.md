# Item Documents — Design

## Goal

Let a user attach files to an item — receipts, warranty cards, manuals — with a type, optional name/description, and an optional warranty-expiry date. The backend already emails a reminder as that date approaches; the frontend just needs to create, list, edit, and delete these documents.

## Context

Backend (`be/src/api/document`) is fully built: `GET /api/v1/documents?itemId=&type=` (list), `GET /api/v1/documents/{id}`, `POST /api/v1/documents/file` (multipart upload, returns `{key, url, mimeType, size}`), `POST /api/v1/documents` (create metadata record from an uploaded `fileKey`), `PATCH /api/v1/documents/{id}` (update metadata — file itself is immutable after creation), `DELETE /api/v1/documents/{id}`. `type` is one of `receipt`/`warranty`/`manual`/`other`. Accepted mime types: `application/pdf`, `image/jpeg`, `image/png`, `image/webp`; 20MB max. `itemId` is required on create, so a document can only be attached to an item that already exists — never during item creation.

Frontend has zero document code. The OpenAPI schema (`fe/src/kernel/api/schema.ts`) already includes these paths — no regeneration needed.

This mirrors two existing patterns closely: file upload (`services/item/api/upload-photo.ts` + `ItemPhotosField`) and a per-entity CRUD data layer with its own list/create/update/delete (`services/recognition`, `services/qr`).

## Scope

**In scope:**

- A "Documents" section on the item detail page (`features/item` → `item.tsx`), rendered as a sibling below the item edit-form card — not inside `ItemEditForm`, since documents are their own collection with independent CRUD, not a field on the item.
- Upload: pick a file (`accept="application/pdf,image/jpeg,image/png,image/webp"`) → immediate upload (`POST /documents/file`) → immediate create with `type: 'other'` as the default (`POST /documents`) → card appears in the list, collapsed.
- Inline edit: clicking a document card expands it in place to edit `type`, `name`, `description`, `warrantyEndsAt`; an explicit "Save" button commits via `PATCH /documents/{id}`.
- Delete: trash icon on the card → `AlertDialog` confirmation (same pattern as `ItemDeleteTrigger`) → `DELETE /documents/{id}`.
- Warranty date display: the date text itself is color-coded by proximity — normal/muted color when more than 30 days out, warning (amber) within 30 days, danger (red) within 7 days or already past. This is a color on the existing date text, not a separate badge element.
- Open/download: clicking the file icon/name opens `file.url` in a new tab; the browser renders PDF/images natively.
- Empty state ("No documents yet" + add button) and list-load error state (`ErrorState` + retry), consistent with the rest of the app.

**Out of scope:**

- Attaching documents during item creation (backend requires an existing `itemId`).
- Any in-app file viewer/preview (no PDF.js, no image lightbox for documents) — delegated entirely to the browser via `window.open`.
- Replacing a document's file after upload (backend doesn't support it — `UpdateDocumentDto` omits `fileKey`; to swap a file the user deletes and re-adds).
- A document-count indicator anywhere outside the item detail page (item list rows, container view, etc.).
- Any frontend logic tied to the backend's warranty-reminder cron — that's entirely server-side (email); the frontend only renders the stored date.

## Architecture

### New `services/document/` slice

Follows the same per-entity data-layer convention as `services/recognition` and `services/item`:

- `api/upload-file.ts` — `uploadDocumentFileRequest(file): Promise<DocumentFileResponseDto>`, multipart `POST /documents/file`, same shape as `uploadItemPhotoRequest`.
- `api/create.ts` — `createDocumentRequest(data: { itemId, type, fileKey, name?, description?, warrantyEndsAt? }): Promise<DocumentResponseDto>`.
- `api/list.ts` — `listDocumentsRequest(itemId: string): Promise<DocumentResponseDto[]>`, calls `GET /documents?itemId=`.
- `api/update.ts` — `updateDocumentRequest(id: string, data: { type?, name?, description?, warrantyEndsAt? }): Promise<DocumentResponseDto>`.
- `api/delete.ts` — `deleteDocumentRequest(id: string): Promise<void>`.
- `api/document.queries.ts` — `byItemKey(itemId)`, `byItem(itemId)` (`queryOptions`, one-shot — no polling, no SSE, this is plain CRUD), `uploadFile()`, `create()`, `update()`, `delete()` (`mutationOptions`).
- `index.ts` — barrel exporting `documentQueries` and the public UI component(s).

### New `features/document/` slice

- `ui/document-list.tsx` — the section itself: heading "Документы", maps `documentQueries.byItem(itemId)` data into `DocumentCard`s, renders a pending-upload placeholder (spinner tile) while `uploadFile`/`create` mutations are in flight, renders the "Add document" hidden-file-input trigger, and the empty/error states. Owns the upload orchestration: on file pick, calls `uploadFile` then `create` in sequence, `toast.danger` with the filename on either failing (mirrors `ItemPhotosField`'s `handleFiles`).
- `ui/document-card.tsx` — one document row: mime-based icon (`FileText` for `application/pdf`, `Image` for the three image mimes), filename/`name` fallback, type badge, warranty date (color-coded per the rule above, only rendered when `warrantyEndsAt` is set), delete trigger (`AlertDialog`, mirrors `ItemDeleteTrigger`). Clicking the row (outside the delete button) toggles an inline expanded edit form: `SelectField` for `type` (options from the four constants), `FormTextField` for `name`, `FormTextareaField` for `description`, a `TextField type="date"` for `warrantyEndsAt`, and a "Save" button that fires the `update` mutation and collapses the card back on success.
- No `model/` layer needed — the upload sequencing lives in `document-list.tsx`, the edit-form state is local `useState` in `document-card.tsx` (uncontrolled per-card, no cross-card coordination required).

`features/document` is a fresh top-level feature (not nested under `features/item`) because it composes independently and could in principle be reused if documents ever attach to another entity — but it is wired into exactly one place today.

### Wiring into `features/item`

`item.tsx` renders `<DocumentList itemId={item.id} />` as its own card/section below the existing `ItemEditForm` card, inside the same page-level container. No changes to `ItemEditForm` itself.

## Data Flow

1. User clicks "Add document" → picks a file → `document-list.tsx` calls `uploadFile(file)`.
2. On upload success, immediately calls `create({ itemId, type: 'other', fileKey: uploadedFile.key })`.
3. On create success, invalidates `documentQueries.byItemKey(itemId)` → list refetches → new card appears, collapsed, showing the filename and an "Other" badge.
4. User clicks the card → it expands → edits fields → "Save" → `update(id, {...})` → on success, invalidates the list and collapses the card.
5. User clicks the trash icon → confirms in `AlertDialog` → `delete(id)` → invalidates the list.

## Error Handling

- Upload failure (`uploadFile` or the follow-up `create`) → `toast.danger('Не удалось загрузить документ: <name>')`, no card added, upload placeholder disappears.
- Update failure → `toast.danger('Не удалось сохранить документ')`, card stays expanded with the user's edits intact (no data loss, no collapse) so they can retry.
- Delete failure → `toast.danger('Не удалось удалить документ')`, `AlertDialog` stays open (same pattern as `ItemDeleteTrigger`).
- List load failure → `ErrorState` with retry, same as `Item`'s own load-failure state.

## Testing / Verification

No automated test runner in this project. `bun run build` + `bun run lint`, plus a manual browser walkthrough on an existing item: upload a PDF and an image, confirm both card icons render correctly, expand a card and edit type/name/description/warranty date and save, confirm the date color changes correctly for a near-future vs. far-future vs. past warranty date, delete a document and confirm the confirmation dialog and removal, confirm the empty state renders on an item with no documents, confirm opening a document's file in a new tab.
