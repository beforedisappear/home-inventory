# Item Recognition (AI Photo Draft) — Design

## Goal

Let a user, while creating an item, upload a photo and have an AI vision model propose a draft (name, description, category, custom fields) that pre-fills the create-item form. The user always reviews and edits before submitting — recognition never creates an item by itself.

## Context

Backend recognition (`be/src/api/recognition`) is fully built: `POST /api/v1/recognitions` (multipart, starts an async job, 409 if the user already has one active), `GET /api/v1/recognitions` (history), `GET /api/v1/recognitions/{id}` (status + draft), `DELETE /api/v1/recognitions/{id}` (cancel), and `GET /api/v1/recognitions/events` (SSE, emits `{recognitionId, status: 'ready'|'failed'}` only — no intermediate progress, no draft payload). Status values: `pending`/`processing`/`ready`/`failed`/`cancelled`. Recognition docs auto-expire after 24h; the temp image is discarded once the draft is ready or the job fails/cancels.

Frontend has zero recognition code, and zero prior SSE consumers — this is the first one. Auth is 100% Bearer-token-in-header (`Authorization`, read from `localStorage` via `apiClient`'s `authMiddleware`); there is no cookie session anywhere in the backend. Native `EventSource` can only send cookies or query params, never custom headers, so it cannot authenticate against this backend as-is.

## Scope

**In scope:**

- File-input photo upload (no live camera capture) inside the existing item-create drawer.
- Async status tracking via a poll/SSE hybrid: `refetchInterval` polling (same pattern as the existing QR feature) as the reliable path, with SSE used only to trigger an immediate refetch on `ready`/`failed` so the UI doesn't wait for the next poll tick.
- SSE consumed via a hand-rolled fetch + `ReadableStream` parser (reuses the existing Bearer-header `apiClient` auth) — **no backend changes**. Native `EventSource` is not used.
- Cancel while `pending`/`processing`, including an implicit cancel if the create-item drawer closes mid-flight.
- On `ready`: draft fields pre-fill the create-item form; the same photo that was sent for recognition is also attached to the item's photos (uploaded through the existing `ItemPhotosField` photo-upload path, so it renders with the same spinner/thumbnail/dedupe behavior as a manually-added photo).
- `categoryId` from the draft (when the AI's `categoryName` matched an existing category) pre-fills the category select directly. When it didn't match (`categoryId: null`, `categoryName` present), the raw `categoryName` is shown as a text hint next to the select — the user picks or creates a category manually via the existing "add category" affordance. No auto-create of categories.

**Out of scope:**

- Live camera capture (`getUserMedia`) — plain `<input type=file accept=image/*>` covers both file picking and, on mobile, the OS camera/gallery chooser.
- Recognition from anywhere other than the create-item flow (no standalone recognition page, no "recognize into an existing item" edit-flow entry point).
- Recognition history (`GET /api/v1/recognitions` listing) — not surfaced anywhere in this scope.
- Reports SSE (`/api/v1/reports/events`) — the fetch-based SSE reader is built specifically for recognition; Reports has no frontend at all yet and isn't touched here.

## Architecture

### New `services/recognition/` slice

Mirrors the existing per-entity data-layer convention (`services/item`, `services/container`):

- `api/create.ts` — `createRecognitionRequest(file): Promise<RecognitionResponseDto>`, multipart POST, same shape as `uploadItemPhotoRequest`.
- `api/get-by-id.ts` — `getRecognitionRequest(id): Promise<RecognitionResponseDto>`.
- `api/cancel.ts` — `cancelRecognitionRequest(id): Promise<RecognitionResponseDto>`.
- `api/events.ts` — opens `GET /api/v1/recognitions/events` via `fetch` (through `apiClient` so the Bearer header is attached automatically), reads the `text/event-stream` body as a `ReadableStream`, parses `event:`/`data:` frames by hand, and exposes a small subscribe function `onRecognitionEvent(callback)`. Reconnects with backoff on stream error/close while there's an active subscriber; stops when the last subscriber unsubscribes.
- `api/recognition.queries.ts` — `byIdKey(id)`, `byId(id)` (`queryOptions`, `refetchInterval` 2s while `status` is `pending`/`processing`, same pattern as `itemQueries.qr`), `create()`, `cancel()` (`mutationOptions`).
- `model/use-recognition.ts` — hook combining the poll query with an `events.ts` subscription (on a matching `ready`/`failed` event, calls `queryClient.invalidateQueries` for that id so the UI updates without waiting for the next poll tick). Exposes `{ status, draft, error, start(file), cancel() }`. `start` fires `create()`; on `409` surfaces a "you already have an active recognition" toast instead of setting an id.
- `ui/recognition-photo-field.tsx` — presentational: file input trigger, spinner while `pending`/`processing`, cancel button, error toast + reset on `failed`. Calls `onDraftReady(draft, file)` once `ready`.

Because `features` may not import each other, and this UI is used only from `features/item-create`, it lives at the `services` layer (same placement as `ItemPhotosField`/`CustomFieldsField` today) rather than as its own `features/recognition` slice.

### `ItemPhotosField` gains an imperative `addFiles` handle

`services/item/ui/item-photos-field.tsx` becomes `forwardRef`, exposing `addFiles(files: File[])` via `useImperativeHandle` that runs the same per-file `uploadPhoto` → `setPhotoMeta` → `field.handleChange` path already used by the manual file-picker `onChange`. This lets the recognition flow attach the recognition photo through the exact same upload/state logic as a manual add — no parallel photo-upload implementation, no separate thumbnail-cache bookkeeping.

### Wiring in `features/item-create`

`create-item-form.tsx`:
- Renders `<RecognitionPhotoField onDraftReady={handleDraftReady} />` above the `name` field.
- Holds `photosFieldRef` and passes it to `<ItemPhotosField ref={photosFieldRef} .../>`.
- `handleDraftReady(draft, file)`: `form.setFieldValue('name', draft.name)`, `form.setFieldValue('description', draft.description ?? '')`, `draft.categoryId && form.setFieldValue('categoryId', draft.categoryId)`, maps `draft.customFields` into the form's `CustomFieldFormValue[]` shape and sets it, calls `photosFieldRef.current?.addFiles([file])`. If `draft.categoryId` is `null` and `draft.categoryName` is present, stores it in local state and renders it as a hint next to the category `SelectField`.
- On drawer close while a recognition is still `pending`/`processing`, fires `cancel()` (cleanup effect) so it doesn't keep burning AI-provider quota for a draft nobody will use.

## Data Flow

1. User picks a file in `RecognitionPhotoField` → `POST /recognitions`. `409` → toast, stop.
2. While `pending`/`processing`: spinner + "Cancel" button (`DELETE /recognitions/{id}`, resets local state on success).
3. `ready` (via SSE-triggered invalidate or the 2s poll, whichever lands first) → refetch `GET /recognitions/{id}` → `draft` flows into the form as described above.
4. `failed` → toast with `draft.error`/a generic fallback, reset, user can retry.
5. Drawer unmounts with an active recognition → cancel fired as cleanup.

## Error Handling

- `409` on create → toast, no recognition started.
- `failed` status → toast + reset, retry always available (just pick a file again).
- SSE stream errors/disconnects → silently reconnect with backoff; the 2s poll is the correctness backstop regardless, so a flaky SSE connection degrades to "poll-only" rather than breaking the feature.
- Photo upload failure inside `addFiles` → same `toast.danger('Не удалось загрузить фото: <name>')` `ItemPhotosField` already uses for manual uploads.

## Testing / Verification

No automated test runner in this project. `bun run build` + `bun run lint`, plus a manual browser walkthrough: upload a recognizable photo, confirm pending spinner, confirm form fields populate on ready (including the photo appearing in `ItemPhotosField`), confirm cancel works mid-flight, confirm a second recognition attempt while one is active surfaces the 409 toast, confirm closing the drawer mid-recognition cancels it server-side (verified via a follow-up `GET /recognitions/{id}` returning `cancelled`).
