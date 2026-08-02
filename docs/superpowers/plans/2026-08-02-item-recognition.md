# Item Recognition (AI Photo Draft) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user upload a photo while creating an item and have an AI vision model pre-fill the create-item form (name, description, category, custom fields) via the already-built backend recognition pipeline.

**Architecture:** Frontend-only. A new `services/recognition/` slice (data layer + SSE reader + presentational `RecognitionPhotoField`) mirrors the existing per-entity/per-slice convention (`services/item`, `services/item/ui/item-photos-field.tsx`). Status is tracked via a poll/SSE hybrid: `refetchInterval` polling is the correctness backstop (same pattern as `itemQueries.qr`), and a hand-rolled `fetch` + `ReadableStream` SSE reader (native `EventSource` cannot send the `Authorization` header this backend requires) triggers an immediate refetch on `ready`/`failed`. `services/item/ui/item-photos-field.tsx` gains an imperative `addFiles` handle so the recognition photo attaches to the item through the exact same upload path as a manual add. Everything is wired together in `features/item-create/ui/create-item-form.tsx`.

**Tech Stack:** React 19 + TanStack Query/Form, `openapi-fetch` (`apiClient`), native `fetch`/`ReadableStream` for SSE (no library).

## Global Constraints

- Frontend commands run from `fe/`: `bun run build`, `bun run lint`. No automated test runner — verification is build + lint + a manual browser walkthrough.
- Backend needs **zero changes** — `be/src/api/recognition` is already fully built and already reflected in `fe/src/kernel/api/schema.ts` (no `bun run api:sync` needed).
- FSD layering: `app → pages → features → services → kernel → shared`. Same-layer cross-import is forbidden between `features` and between `services`. `services/recognition` must not import `services/item` or vice versa — shared wiring happens one layer up, in `features/item-create`.
- Auth is 100% Bearer-token-in-header (`tokenStorage.getAccess()`, no cookies) — the SSE reader must attach this header manually via raw `fetch`, since native `EventSource` cannot set custom headers.
- User-facing copy is in Russian, matching every existing feature.
- No `git commit` without a fresh, explicit per-turn user request; project works directly on `main`, no worktrees/feature branches.
- Recognition never creates an item itself — it only pre-fills the create-item form; the user still reviews and submits manually.

---

### Task 1: `services/recognition` data layer

**Files:**
- Create: `fe/src/services/recognition/api/create.ts`
- Create: `fe/src/services/recognition/api/get-by-id.ts`
- Create: `fe/src/services/recognition/api/cancel.ts`
- Create: `fe/src/services/recognition/api/recognition.queries.ts`
- Create: `fe/src/services/recognition/index.ts`

**Interfaces:**
- Consumes: `apiClient` (`@/shared/api/api-client`), `components['schemas']['RecognitionResponseDto']` (`@/kernel/api/schema`).
- Produces: `createRecognitionRequest(file: File): Promise<RecognitionResponseDto>`, `getRecognitionRequest(id: string): Promise<RecognitionResponseDto>`, `cancelRecognitionRequest(id: string): Promise<RecognitionResponseDto>`, `recognitionQueries.byIdKey(id)`, `recognitionQueries.byId(id)`, `recognitionQueries.create()`, `recognitionQueries.cancel()`.

- [ ] Create `fe/src/services/recognition/api/create.ts`:

```ts
import type { components } from '@/kernel/api/schema';
import { apiClient } from '@/shared/api/api-client';

type RecognitionResponseDto = components['schemas']['RecognitionResponseDto'];

export async function createRecognitionRequest(
  file: File,
): Promise<RecognitionResponseDto> {
  const formData = new FormData();
  formData.append('file', file);

  const { data, error } = await apiClient.POST('/api/v1/recognitions', {
    // openapi-fetch пропускает FormData как есть, минуя JSON-сериализацию;
    // сгенерированный тип тела ({file?: string}) этого не отражает
    body: formData as never,
  });

  if (error) throw error;

  return data!;
}
```

- [ ] Create `fe/src/services/recognition/api/get-by-id.ts`:

```ts
import type { components } from '@/kernel/api/schema';
import { apiClient } from '@/shared/api/api-client';

type RecognitionResponseDto = components['schemas']['RecognitionResponseDto'];

export async function getRecognitionRequest(
  id: string,
): Promise<RecognitionResponseDto> {
  const { data, error } = await apiClient.GET('/api/v1/recognitions/{id}', {
    params: { path: { id } },
  });

  if (error) throw error;

  return data!;
}
```

- [ ] Create `fe/src/services/recognition/api/cancel.ts`:

```ts
import type { components } from '@/kernel/api/schema';
import { apiClient } from '@/shared/api/api-client';

type RecognitionResponseDto = components['schemas']['RecognitionResponseDto'];

export async function cancelRecognitionRequest(
  id: string,
): Promise<RecognitionResponseDto> {
  const { data, error } = await apiClient.DELETE(
    '/api/v1/recognitions/{id}',
    { params: { path: { id } } },
  );

  if (error) throw error;

  return data!;
}
```

- [ ] Create `fe/src/services/recognition/api/recognition.queries.ts`:

```ts
import { mutationOptions, queryOptions } from '@tanstack/react-query';

import { cancelRecognitionRequest } from './cancel';
import { createRecognitionRequest } from './create';
import { getRecognitionRequest } from './get-by-id';

export const recognitionQueries = {
  byIdKey: (id: string) => ['recognitions', 'by-id', id] as const,

  byId: (id: string) =>
    queryOptions({
      queryKey: recognitionQueries.byIdKey(id),
      queryFn: () => getRecognitionRequest(id),
      refetchInterval: query =>
        query.state.data?.status === 'pending' ||
        query.state.data?.status === 'processing'
          ? 2000
          : false,
    }),

  create: () =>
    mutationOptions({
      mutationFn: createRecognitionRequest,
    }),

  cancel: () =>
    mutationOptions({
      mutationFn: cancelRecognitionRequest,
    }),
};
```

- [ ] Create `fe/src/services/recognition/index.ts` (barrel, so far):

```ts
export { recognitionQueries } from './api/recognition.queries';
```

- [ ] Verify: `cd fe && bun run build && bun run lint` — clean (nothing imports this slice yet, so this only checks the new files type-check and lint standalone).

### Task 2: SSE reader (`api/events.ts`)

**Files:**
- Create: `fe/src/services/recognition/api/events.ts`

**Interfaces:**
- Consumes: `tokenStorage` (`@/shared/api/token-storage`), `env` (`@/shared/config/env`).
- Produces: `onRecognitionEvent(listener: (event: RecognitionSseEvent) => void): () => void` where `RecognitionSseEvent = { recognitionId: string; status: 'ready' | 'failed' }`. Calling it opens a shared, module-level SSE connection to `GET /api/v1/recognitions/events` (lazily, on first subscriber; torn down when the last subscriber unsubscribes). Returned function unsubscribes.

**Wire format reference** (confirmed against `be/node_modules/@nestjs/core/router/sse-stream.js` and `be/src/api/recognition/services/recognition-events.service.ts`): each frame is `event: recognition\ndata: {"recognitionId":"...","status":"ready"}\n\n` for real events, or `event: ping\n\n` (no `data:` line — Nest's SSE writer omits `data:` when the payload is falsy) for the 25s heartbeat. Frames are separated by a blank line (`\n\n`).

- [ ] Create `fe/src/services/recognition/api/events.ts`:

```ts
import { tokenStorage } from '@/shared/api/token-storage';
import { env } from '@/shared/config/env';

export interface RecognitionSseEvent {
  recognitionId: string;
  status: 'ready' | 'failed';
}

type Listener = (event: RecognitionSseEvent) => void;

const listeners = new Set<Listener>();

let abortController: AbortController | null = null;
let reconnectTimer: ReturnType<typeof setTimeout> | null = null;
let reconnectAttempt = 0;

function parseFrame(frame: string): RecognitionSseEvent | null {
  const lines = frame.split('\n');
  const eventLine = lines.find(line => line.startsWith('event:'));
  const dataLine = lines.find(line => line.startsWith('data:'));

  if (!eventLine || !dataLine) return null;
  if (eventLine.slice(6).trim() !== 'recognition') return null;

  try {
    return JSON.parse(dataLine.slice(5).trim()) as RecognitionSseEvent;
  } catch {
    return null;
  }
}

function scheduleReconnect(): void {
  if (listeners.size === 0) return;

  const delay = Math.min(1000 * 2 ** reconnectAttempt, 30_000);
  reconnectAttempt += 1;
  reconnectTimer = setTimeout(() => void connect(), delay);
}

async function connect(): Promise<void> {
  if (listeners.size === 0) return;

  abortController = new AbortController();

  try {
    const access = tokenStorage.getAccess();

    const response = await fetch(`${env.apiUrl}/api/v1/recognitions/events`, {
      headers: access ? { Authorization: `Bearer ${access}` } : {},
      signal: abortController.signal,
    });

    if (!response.ok || !response.body) {
      throw new Error(`SSE connection failed: ${response.status}`);
    }

    reconnectAttempt = 0;

    const reader = response.body.getReader();
    const decoder = new TextDecoder();
    let buffer = '';

    for (;;) {
      const { done, value } = await reader.read();
      if (done) break;

      buffer += decoder.decode(value, { stream: true });

      const frames = buffer.split('\n\n');
      buffer = frames.pop() ?? '';

      for (const frame of frames) {
        const event = parseFrame(frame);
        if (event) listeners.forEach(listener => listener(event));
      }
    }
  } catch {
    // сеть/abort — просто уходим в reconnect ниже; 2с polling остаётся
    // подстраховкой, если реконнект по какой-то причине не восстановится
  }

  scheduleReconnect();
}

export function onRecognitionEvent(listener: Listener): () => void {
  listeners.add(listener);

  if (listeners.size === 1) {
    reconnectAttempt = 0;
    void connect();
  }

  return () => {
    listeners.delete(listener);

    if (listeners.size === 0) {
      abortController?.abort();
      abortController = null;

      if (reconnectTimer) clearTimeout(reconnectTimer);
      reconnectTimer = null;
    }
  };
}
```

- [ ] Verify types: `cd fe && bun run build` — clean.
- [ ] Manual smoke test (no harness for this in isolation, so verify via the browser devtools console against a running dev server + backend):
  1. Start backend (`be`) and frontend (`fe`) dev servers, log in in the browser.
  2. In the browser devtools console, run:
     ```js
     import('/src/services/recognition/api/events.ts').then(m =>
       m.onRecognitionEvent(e => console.log('recognition event', e)),
     );
     ```
  3. In another tab/terminal, `curl` a recognition through with a real access token (`POST /api/v1/recognitions` with a small JPEG, using the same Bearer token from `localStorage['hi.access']`) and confirm the console logs a `{recognitionId, status: 'ready'|'failed'}` object once the backend finishes processing.
  This step is exploratory — it's fine to do it once while building Task 4's UI instead of in isolation, as long as it's confirmed before Task 6's final walkthrough.

### Task 3: `use-recognition` hook

**Files:**
- Create: `fe/src/services/recognition/model/use-recognition.ts`

**Interfaces:**
- Consumes: `recognitionQueries` (Task 1), `onRecognitionEvent` (Task 2), `toast` (`@/shared/ui`).
- Produces: `useRecognition(): { status: RecognitionStatus | null; draft: RecognitionDraftDto | null; error: string | null; isStarting: boolean; start(file: File): Promise<void>; cancel(): Promise<void>; reset(): void }`.

- [ ] Create `fe/src/services/recognition/model/use-recognition.ts`:

```ts
import { useEffect, useRef, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';

import { toast } from '@/shared/ui';

import { onRecognitionEvent } from '../api/events';
import { recognitionQueries } from '../api/recognition.queries';

function isConflict(err: unknown): boolean {
  return (
    err !== null &&
    typeof err === 'object' &&
    'statusCode' in err &&
    (err as { statusCode?: number }).statusCode === 409
  );
}

export function useRecognition() {
  const [recognitionId, setRecognitionId] = useState<string | null>(null);
  const queryClient = useQueryClient();

  const { data } = useQuery({
    ...recognitionQueries.byId(recognitionId ?? ''),
    enabled: recognitionId !== null,
  });

  const { mutateAsync: createRecognition, isPending: isStarting } =
    useMutation(recognitionQueries.create());
  const { mutateAsync: cancelRecognition } = useMutation(
    recognitionQueries.cancel(),
  );

  // SSE — быстрый путь: приходит ready/failed, сразу инвалидируем и рефетчим,
  // не дожидаясь следующего тика 2с polling (который остаётся подстраховкой)
  useEffect(() => {
    if (!recognitionId) return undefined;

    return onRecognitionEvent(event => {
      if (event.recognitionId !== recognitionId) return;

      void queryClient.invalidateQueries({
        queryKey: recognitionQueries.byIdKey(recognitionId),
      });
    });
  }, [recognitionId, queryClient]);

  // отменяем незавершённое распознавание, если хук размонтировался
  // (юзер закрыл дровер) — рефы держат актуальные значения на момент unmount
  const idRef = useRef(recognitionId);
  idRef.current = recognitionId;
  const statusRef = useRef(data?.status ?? null);
  statusRef.current = data?.status ?? null;

  useEffect(() => {
    return () => {
      const id = idRef.current;
      const status = statusRef.current;

      if (id && (status === 'pending' || status === 'processing')) {
        void cancelRecognition(id);
      }
    };
    // deps: [cancelRecognition] — id/status намеренно не в массиве, их
    // актуальные значения на момент unmount берём из рефов выше
  }, [cancelRecognition]);

  const start = async (file: File) => {
    try {
      const recognition = await createRecognition(file);
      setRecognitionId(recognition.id);
    } catch (err) {
      toast.danger(
        isConflict(err)
          ? 'У вас уже есть активное распознавание — дождитесь его завершения'
          : 'Не удалось запустить распознавание',
      );
    }
  };

  const cancel = async () => {
    if (!recognitionId) return;

    try {
      await cancelRecognition(recognitionId);
    } finally {
      setRecognitionId(null);
    }
  };

  const reset = () => setRecognitionId(null);

  return {
    status: data?.status ?? null,
    draft: data?.draft ?? null,
    error: data?.error ?? null,
    isStarting,
    start,
    cancel,
    reset,
  };
}
```

- [ ] Verify: `cd fe && bun run build && bun run lint` — clean.

### Task 4: `RecognitionPhotoField` UI

**Files:**
- Create: `fe/src/services/recognition/ui/recognition-photo-field.tsx`
- Modify: `fe/src/services/recognition/index.ts` (export `RecognitionPhotoField`)

**Interfaces:**
- Consumes: `useRecognition` (Task 3), `Button`/`Spinner`/`toast` (`@/shared/ui`), `components['schemas']['RecognitionDraftDto']` (`@/kernel/api/schema`).
- Produces: `<RecognitionPhotoField onDraftReady={(draft: RecognitionDraftDto, file: File) => void} />`.

- [ ] Create `fe/src/services/recognition/ui/recognition-photo-field.tsx`:

```tsx
import { useEffect, useRef } from 'react';
import { Camera } from 'lucide-react';

import type { components } from '@/kernel/api/schema';

import { Button, Spinner, toast } from '@/shared/ui';

import { useRecognition } from '../model/use-recognition';

type RecognitionDraftDto = components['schemas']['RecognitionDraftDto'];

const ACCEPTED_MIME_TYPES = 'image/jpeg,image/png,image/webp';

interface Props {
  onDraftReady: (draft: RecognitionDraftDto, file: File) => void;
}

export function RecognitionPhotoField(props: Props) {
  const { onDraftReady } = props;

  const { status, draft, error, isStarting, start, cancel, reset } =
    useRecognition();

  const pendingFileRef = useRef<File | null>(null);

  useEffect(() => {
    if (status === 'ready' && draft && pendingFileRef.current) {
      onDraftReady(draft, pendingFileRef.current);
      pendingFileRef.current = null;
      reset();
    }

    if (status === 'failed') {
      toast.danger(error ?? 'Не удалось распознать вещь по фото');
      pendingFileRef.current = null;
      reset();
    }
  }, [status, draft, error, onDraftReady, reset]);

  const isActive = status === 'pending' || status === 'processing';

  const handleChange = (files: FileList | null) => {
    const file = files?.[0];
    if (!file) return;

    pendingFileRef.current = file;
    void start(file);
  };

  return (
    <div className='flex items-center gap-2'>
      <label className='flex w-fit cursor-pointer items-center gap-2 rounded-lg border border-dashed border-border px-3 py-2 text-sm text-muted transition-colors hover:border-primary hover:text-primary'>
        {isActive || isStarting ? <Spinner size='sm' /> : <Camera size={16} />}
        Заполнить по фото
        <input
          type='file'
          accept={ACCEPTED_MIME_TYPES}
          className='hidden'
          disabled={isActive || isStarting}
          onChange={e => {
            handleChange(e.target.files);
            e.target.value = '';
          }}
        />
      </label>

      {isActive && (
        <Button
          type='button'
          variant='ghost'
          size='sm'
          onPress={() => void cancel()}
        >
          Отмена
        </Button>
      )}
    </div>
  );
}
```

- [ ] Update `fe/src/services/recognition/index.ts`:

```ts
export { recognitionQueries } from './api/recognition.queries';
export { RecognitionPhotoField } from './ui/recognition-photo-field';
```

- [ ] Verify: `cd fe && bun run build && bun run lint` — clean (still unused by any page — that's Task 6).

### Task 5: `ItemPhotosField` imperative `addFiles` handle + `fromCustomFieldsDto` mapper

**Files:**
- Modify: `fe/src/services/item/ui/item-photos-field.tsx`
- Modify: `fe/src/services/item/model/item-form-mapper.ts`
- Modify: `fe/src/services/item/index.ts`

**Interfaces:**
- Produces: `ItemPhotosFieldHandle { addFiles(files: File[]): void }` (ref type), `fromCustomFieldsDto(fields: CustomFieldDto[]): CustomFieldFormValue[]`.
- Consumes (by Task 6): both of the above, plus the existing `ItemPhotosField`/`toItemDto` exports (unchanged).

`ItemPhotosField` currently is `export function ItemPhotosField(props: Props)`. Convert it to `forwardRef` and extract the per-file upload logic (currently inline in `handleFilesSelected`) into a reusable `handleFiles(files: File[])` that's both the manual file-input path and the new imperative `addFiles`:

- [ ] Modify `fe/src/services/item/ui/item-photos-field.tsx`:
  - Add `forwardRef, useImperativeHandle` to the `react` import.
  - Add and export:
    ```ts
    export interface ItemPhotosFieldHandle {
      addFiles: (files: File[]) => void;
    }
    ```
  - Replace `export function ItemPhotosField(props: Props) {` / closing `}` with:
    ```tsx
    export const ItemPhotosField = forwardRef<ItemPhotosFieldHandle, Props>(
      function ItemPhotosField(props, ref) {
        // ...existing body...
      },
    );
    ```
  - Inside the body, replace the existing `handleFilesSelected` with:
    ```tsx
    const handleFiles = (files: File[]) => {
      files.forEach(file => {
        uploadPhoto(file)
          .then(photo => {
            setPhotoMeta(meta => ({ ...meta, [photo.key]: photo }));
            field.handleChange((keys: string[]) => [...keys, photo.key]);
          })
          .catch(() => {
            toast.danger(`Не удалось загрузить фото: ${file.name}`);
          });
      });
    };

    useImperativeHandle(ref, () => ({ addFiles: handleFiles }));

    const handleFilesSelected = (files: FileList | null) => {
      if (!files) return;
      handleFiles(Array.from(files));
    };
    ```
    (everything else in the component — `handleDelete`, `handleDragEnd`, the JSX — stays exactly as-is; only `handleFilesSelected`'s body changes to delegate into `handleFiles`).

- [ ] Modify `fe/src/services/item/model/item-form-mapper.ts` — add, alongside the existing `toCustomFieldsDto`:

```ts
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
```

- [ ] Modify `fe/src/services/item/index.ts`:

```ts
export { itemQueries } from './api/item.queries';
export {
  customFieldsSchema,
  type CustomFieldFormValue,
} from './model/custom-fields-schema';
export { fromCustomFieldsDto, toItemDto } from './model/item-form-mapper';
export { CustomFieldsField } from './ui/custom-fields-field';
export {
  ItemPhotosField,
  type ItemPhotosFieldHandle,
} from './ui/item-photos-field';
```

- [ ] Verify: `cd fe && bun run build && bun run lint` — clean. `fe/src/features/item/ui/item-edit-form.tsx` still renders `<ItemPhotosField field={field} initialPhotos={item.photos} />` without a `ref` — `forwardRef` components accept but don't require a `ref` prop, so this caller needs no changes; confirm the build doesn't flag it.

### Task 6: Wire into `create-item-form.tsx` + final verification

**Files:**
- Modify: `fe/src/features/item-create/ui/create-item-form.tsx`

**Interfaces:**
- Consumes: `RecognitionPhotoField` (Task 4), `ItemPhotosFieldHandle`/`fromCustomFieldsDto` (Task 5), `components['schemas']['RecognitionDraftDto']` (`@/kernel/api/schema`).

- [ ] Rewrite `fe/src/features/item-create/ui/create-item-form.tsx`:

```tsx
import { useRef, useState } from 'react';
import type { ReactNode } from 'react';
import { useIsMutating, useQuery } from '@tanstack/react-query';

import { categoryQueries } from '@/services/category';
import {
  CustomFieldsField,
  fromCustomFieldsDto,
  ItemPhotosField,
  itemQueries,
  type ItemPhotosFieldHandle,
} from '@/services/item';
import { RecognitionPhotoField } from '@/services/recognition';

import type { components } from '@/kernel/api/schema';

import {
  Button,
  Drawer,
  FormTextareaField,
  FormTextField,
  SelectField,
  Spinner,
  Typography,
} from '@/shared/ui';

import { useCreateItemForm } from '../model/use-create-item-form';

type RecognitionDraftDto = components['schemas']['RecognitionDraftDto'];

interface Props {
  containerId: string;
  onSuccess: () => void;
  categorySlot?: ReactNode;
}

export function CreateItemForm(props: Props) {
  const { containerId, onSuccess, categorySlot } = props;

  const { form } = useCreateItemForm({ containerId, onSuccess });

  const { data: categories } = useQuery(categoryQueries.list());
  const uploadingCount = useIsMutating({
    mutationKey: itemQueries.uploadPhotoKey(),
  });

  const photosFieldRef = useRef<ItemPhotosFieldHandle>(null);
  const [categoryHint, setCategoryHint] = useState<string | null>(null);

  const handleDraftReady = (draft: RecognitionDraftDto, file: File) => {
    form.setFieldValue('name', draft.name);
    form.setFieldValue('description', draft.description ?? '');

    if (draft.categoryId) {
      form.setFieldValue('categoryId', draft.categoryId);
      setCategoryHint(null);
    } else {
      setCategoryHint(draft.categoryName);
    }

    form.setFieldValue(
      'customFields',
      fromCustomFieldsDto(draft.customFields),
    );

    photosFieldRef.current?.addFiles([file]);
  };

  return (
    <form
      className='flex min-h-0 flex-1 flex-col'
      onSubmit={e => {
        e.preventDefault();
        e.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <Drawer.Body className='flex flex-col gap-4'>
        <RecognitionPhotoField onDraftReady={handleDraftReady} />

        <form.Field name='name'>
          {field => <FormTextField field={field} label='Название' />}
        </form.Field>

        <form.Field name='categoryId'>
          {field => (
            <div className='flex flex-col gap-1'>
              <div className='flex items-end gap-2'>
                <SelectField
                  className='flex-1'
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
                {categorySlot}
              </div>

              {categoryHint && (
                <Typography type='body-sm' color='muted'>
                  ИИ предложил категорию «{categoryHint}» — выберите её или
                  создайте вручную
                </Typography>
              )}
            </div>
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
            <ItemPhotosField
              ref={photosFieldRef}
              field={field}
              initialPhotos={[]}
            />
          )}
        </form.Field>

        <form.Field name='customFields'>
          {field => <CustomFieldsField field={field} />}
        </form.Field>
      </Drawer.Body>

      <Drawer.Footer>
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
      </Drawer.Footer>
    </form>
  );
}
```

- [ ] Verify build/lint: `cd fe && bun run build && bun run lint` — clean.
- [ ] Manual browser walkthrough (start backend + frontend dev servers):
  1. Open a container, click "Добавить вещь", confirm the new "Заполнить по фото" control renders above the name field.
  2. Pick a clear photo of a recognizable object. Confirm the spinner + "Отмена" button appear, and the rest of the form stays usable while it's pending.
  3. Wait for it to resolve `ready`: confirm `name`/`description` populate, `customFields` (if the model proposed any) appear in `CustomFieldsField`, and the same photo appears as a thumbnail in the photos grid with no separate upload action from you.
  4. If the proposed category matched an existing one, confirm the category select shows it selected. If not, confirm the "ИИ предложил категорию «...»" hint text appears and the select stays on "Без категории".
  5. Submit the form, confirm the created item has the pre-filled fields, the attached photo, and any custom fields.
  6. Start a new recognition, click "Отмена" mid-flight: confirm the spinner disappears and the control returns to its idle state.
  7. Start a new recognition and immediately close the drawer (before it resolves): confirm (via a follow-up `GET /api/v1/recognitions/{id}` — either through Network tab or the recognition history endpoint) that its status ends up `cancelled`, not left `pending`/`processing`.
  8. Start a recognition, and before it resolves, start a second one (reopen the drawer or a second create flow): confirm the second attempt surfaces the "у вас уже есть активное распознавание" toast (backend 409) rather than silently doing nothing.
  9. Pick a deliberately unrecognizable/blank image if feasible, or otherwise confirm the `failed` path: a toast appears with an error message and the control resets to idle, ready to retry.
