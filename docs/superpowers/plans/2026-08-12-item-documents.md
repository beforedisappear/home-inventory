# Item Documents Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user attach files (receipts, warranty cards, manuals) to an item on the item detail page, with a type, optional name/description, and an optional warranty-expiry date, via the already-built backend `/documents` API.

**Architecture:** Frontend-only. A new `services/document/` slice (data layer + type constants + a warranty-date color helper) mirrors the existing per-entity convention (`services/recognition`, `services/item`). A new `features/document/` slice renders a "Documents" section: `DocumentList` owns upload orchestration and empty/error states, `DocumentCard` is one row with an inline expand-to-edit form and a delete confirmation. Wired into `features/item/ui/item.tsx` as its own card below the existing `ItemEditForm` card — documents are a separate collection with independent CRUD, not a field on the item.

**Tech Stack:** React 19 + TanStack Query, `openapi-fetch` (`apiClient`), HeroUI (`@heroui/react` via `@/shared/ui`).

## Global Constraints

- Frontend commands run from `fe/`: `bun run build`, `bun run lint`. No automated test runner — verification is build + lint + a manual browser walkthrough.
- Backend needs **zero changes** — `be/src/api/document` is already fully built and already reflected in `fe/src/kernel/api/schema.ts` (no `bun run api:sync` needed).
- FSD layering: `app → pages → features → services → kernel → shared`. Same-layer cross-import is forbidden between `features` and between `services`.
- User-facing copy is in Russian, matching every existing feature.
- No `git commit` without a fresh, explicit per-turn user request; project works directly on `main`, no worktrees/feature branches.
- A document can only be created against an existing item (`itemId` is required by the backend) — this feature only touches the item detail page, never the create-item flow.
- `UpdateDocumentDto`'s `name`/`description`/`warrantyEndsAt` are optional strings, not nullable — the backend has no way to explicitly clear a previously-set value via `PATCH`. The edit form must never send an empty string for these fields; omit them (`undefined`) instead, which the backend treats as "leave unchanged."

---

### Task 1: `services/document` data layer

**Files:**
- Create: `fe/src/services/document/api/upload-file.ts`
- Create: `fe/src/services/document/api/create.ts`
- Create: `fe/src/services/document/api/list.ts`
- Create: `fe/src/services/document/api/update.ts`
- Create: `fe/src/services/document/api/delete.ts`
- Create: `fe/src/services/document/api/document.queries.ts`
- Create: `fe/src/services/document/model/document-constants.ts`
- Create: `fe/src/services/document/model/warranty-status.ts`
- Create: `fe/src/services/document/index.ts`

**Interfaces:**
- Consumes: `apiClient` (`@/shared/api/api-client`), `queryClient` (`@/shared/api/query-client`), `components['schemas']['DocumentResponseDto'|'DocumentFileResponseDto'|'CreateDocumentDto'|'UpdateDocumentDto']` (`@/kernel/api/schema`).
- Produces: `uploadDocumentFileRequest(file: File): Promise<DocumentFileResponseDto>`, `createDocumentRequest(dto: CreateDocumentDto): Promise<DocumentResponseDto>`, `listDocumentsRequest(itemId: string): Promise<DocumentResponseDto[]>`, `updateDocumentRequest(id: string, dto: UpdateDocumentDto): Promise<DocumentResponseDto>`, `deleteDocumentRequest(id: string): Promise<void>`, `documentQueries.byItemKey(itemId)`, `documentQueries.byItem(itemId)`, `documentQueries.uploadFile()`, `documentQueries.create()`, `documentQueries.update()`, `documentQueries.delete()`, `DOCUMENT_TYPES`, `DocumentType`, `DOCUMENT_TYPE_LABELS`, `getWarrantyColorClass(warrantyEndsAt: string | null): string | undefined`.

- [ ] Create `fe/src/services/document/api/upload-file.ts`:

```ts
import type { components } from '@/kernel/api/schema';
import { apiClient } from '@/shared/api/api-client';

type DocumentFileResponseDto =
  components['schemas']['DocumentFileResponseDto'];

export async function uploadDocumentFileRequest(
  file: File,
): Promise<DocumentFileResponseDto> {
  const formData = new FormData();
  formData.append('file', file);

  const { data, error } = await apiClient.POST('/api/v1/documents/file', {
    // openapi-fetch пропускает FormData как есть, минуя JSON-сериализацию;
    // сгенерированный тип тела ({file?: string}) этого не отражает
    body: formData as never,
  });

  if (error) throw error;

  return data!;
}
```

- [ ] Create `fe/src/services/document/api/create.ts`:

```ts
import type { components } from '@/kernel/api/schema';
import { apiClient } from '@/shared/api/api-client';

type CreateDocumentDto = components['schemas']['CreateDocumentDto'];
type DocumentResponseDto = components['schemas']['DocumentResponseDto'];

export async function createDocumentRequest(
  dto: CreateDocumentDto,
): Promise<DocumentResponseDto> {
  const { data, error } = await apiClient.POST('/api/v1/documents', {
    body: dto,
  });

  if (error) throw error;

  return data!;
}
```

- [ ] Create `fe/src/services/document/api/list.ts`:

```ts
import type { components } from '@/kernel/api/schema';
import { apiClient } from '@/shared/api/api-client';

type DocumentResponseDto = components['schemas']['DocumentResponseDto'];

export async function listDocumentsRequest(
  itemId: string,
): Promise<DocumentResponseDto[]> {
  const { data, error } = await apiClient.GET('/api/v1/documents', {
    params: { query: { itemId } },
  });

  if (error) throw error;

  return data!;
}
```

- [ ] Create `fe/src/services/document/api/update.ts`:

```ts
import type { components } from '@/kernel/api/schema';
import { apiClient } from '@/shared/api/api-client';

type UpdateDocumentDto = components['schemas']['UpdateDocumentDto'];
type DocumentResponseDto = components['schemas']['DocumentResponseDto'];

export async function updateDocumentRequest(
  id: string,
  dto: UpdateDocumentDto,
): Promise<DocumentResponseDto> {
  const { data, error } = await apiClient.PATCH('/api/v1/documents/{id}', {
    params: { path: { id } },
    body: dto,
  });

  if (error) throw error;

  return data!;
}
```

- [ ] Create `fe/src/services/document/api/delete.ts`:

```ts
import { apiClient } from '@/shared/api/api-client';

export async function deleteDocumentRequest(id: string): Promise<void> {
  const { error } = await apiClient.DELETE('/api/v1/documents/{id}', {
    params: { path: { id } },
  });

  if (error) throw error;
}
```

- [ ] Create `fe/src/services/document/api/document.queries.ts`:

```ts
import { mutationOptions, queryOptions } from '@tanstack/react-query';

import type { components } from '@/kernel/api/schema';
import { queryClient } from '@/shared/api/query-client';

import { createDocumentRequest } from './create';
import { deleteDocumentRequest } from './delete';
import { listDocumentsRequest } from './list';
import { updateDocumentRequest } from './update';
import { uploadDocumentFileRequest } from './upload-file';

type UpdateDocumentDto = components['schemas']['UpdateDocumentDto'];

export const documentQueries = {
  byItemKey: (itemId: string) => ['documents', 'by-item', itemId] as const,

  byItem: (itemId: string) =>
    queryOptions({
      queryKey: documentQueries.byItemKey(itemId),
      queryFn: () => listDocumentsRequest(itemId),
    }),

  uploadFile: () =>
    mutationOptions({
      mutationFn: uploadDocumentFileRequest,
    }),

  create: () =>
    mutationOptions({
      mutationFn: createDocumentRequest,
      onSuccess: data => {
        queryClient.invalidateQueries({
          queryKey: documentQueries.byItemKey(data.itemId),
        });
      },
    }),

  update: () =>
    mutationOptions({
      mutationFn: (vars: {
        id: string;
        itemId: string;
        dto: UpdateDocumentDto;
      }) => updateDocumentRequest(vars.id, vars.dto),
      onSuccess: (_data, vars) => {
        queryClient.invalidateQueries({
          queryKey: documentQueries.byItemKey(vars.itemId),
        });
      },
    }),

  delete: () =>
    mutationOptions({
      mutationFn: (vars: { id: string; itemId: string }) =>
        deleteDocumentRequest(vars.id),
      onSuccess: (_data, vars) => {
        queryClient.invalidateQueries({
          queryKey: documentQueries.byItemKey(vars.itemId),
        });
      },
    }),
};
```

- [ ] Create `fe/src/services/document/model/document-constants.ts`:

```ts
export const DOCUMENT_TYPES = [
  'receipt',
  'warranty',
  'manual',
  'other',
] as const;

export type DocumentType = (typeof DOCUMENT_TYPES)[number];

export const DOCUMENT_TYPE_LABELS: Record<DocumentType, string> = {
  receipt: 'Чек',
  warranty: 'Гарантия',
  manual: 'Инструкция',
  other: 'Другое',
};
```

- [ ] Create `fe/src/services/document/model/warranty-status.ts`:

```ts
const DAY_MS = 24 * 60 * 60 * 1000;

// null — гарантии нет, ничего не подсвечиваем. ≤7 дней (включая просроченную)
// — красный, ≤30 — жёлтый, дальше — обычный цвет текста (undefined class)
export function getWarrantyColorClass(
  warrantyEndsAt: string | null,
): string | undefined {
  if (!warrantyEndsAt) return undefined;

  const daysLeft = (new Date(warrantyEndsAt).getTime() - Date.now()) / DAY_MS;

  if (daysLeft <= 7) return 'text-danger';
  if (daysLeft <= 30) return 'text-warning';

  return undefined;
}
```

- [ ] Create `fe/src/services/document/index.ts`:

```ts
export { documentQueries } from './api/document.queries';
export {
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_TYPES,
  type DocumentType,
} from './model/document-constants';
export { getWarrantyColorClass } from './model/warranty-status';
```

- [ ] Verify: `cd fe && bun run build && bun run lint` — clean (nothing imports this slice yet, so this only checks the new files type-check and lint standalone).

### Task 2: `DocumentCard` UI

**Files:**
- Create: `fe/src/features/document/ui/document-card.tsx`

**Interfaces:**
- Consumes: `documentQueries`, `DOCUMENT_TYPES`, `DOCUMENT_TYPE_LABELS`, `getWarrantyColorClass`, `DocumentType` (Task 1, `@/services/document`), `components['schemas']['DocumentResponseDto']` (`@/kernel/api/schema`), `AlertDialog`/`Button`/`Chip`/`Input`/`Label`/`SelectField`/`Spinner`/`TextArea`/`TextField`/`Typography`/`toast`/`useOverlayState` (`@/shared/ui`).
- Produces: `<DocumentCard doc={DocumentResponseDto} />`.

- [ ] Create `fe/src/features/document/ui/document-card.tsx`:

```tsx
import { useState } from 'react';

import { useMutation } from '@tanstack/react-query';
import { FileText, Image as ImageIcon, Trash2 } from 'lucide-react';

import {
  DOCUMENT_TYPE_LABELS,
  DOCUMENT_TYPES,
  documentQueries,
  getWarrantyColorClass,
  type DocumentType,
} from '@/services/document';

import type { components } from '@/kernel/api/schema';

import {
  AlertDialog,
  Button,
  Chip,
  Input,
  Label,
  SelectField,
  Spinner,
  TextArea,
  TextField,
  Typography,
  toast,
  useOverlayState,
} from '@/shared/ui';

type DocumentResponseDto = components['schemas']['DocumentResponseDto'];

const TYPE_OPTIONS = DOCUMENT_TYPES.map(type => ({
  id: type,
  label: DOCUMENT_TYPE_LABELS[type],
}));

// date-input ждёт 'YYYY-MM-DD'; бек отдаёт полный ISO datetime
function toDateInputValue(iso: string | null): string {
  return iso ? iso.slice(0, 10) : '';
}

interface Props {
  doc: DocumentResponseDto;
}

export function DocumentCard(props: Props) {
  const { doc } = props;

  const [isExpanded, setIsExpanded] = useState(false);
  const [type, setType] = useState<DocumentType>(doc.type);
  const [name, setName] = useState(doc.name ?? '');
  const [description, setDescription] = useState(doc.description ?? '');
  const [warrantyEndsAt, setWarrantyEndsAt] = useState(
    toDateInputValue(doc.warrantyEndsAt),
  );

  const deleteState = useOverlayState();

  const { mutateAsync: updateDocument, isPending: isSaving } = useMutation(
    documentQueries.update(),
  );
  const { mutateAsync: deleteDocument, isPending: isDeleting } = useMutation(
    documentQueries.delete(),
  );

  const handleExpand = () => {
    setType(doc.type);
    setName(doc.name ?? '');
    setDescription(doc.description ?? '');
    setWarrantyEndsAt(toDateInputValue(doc.warrantyEndsAt));
    setIsExpanded(true);
  };

  const handleSave = async () => {
    try {
      await updateDocument({
        id: doc.id,
        itemId: doc.itemId,
        dto: {
          type,
          // пустая строка не шлётся — бек трактует undefined как "не менять",
          // явного "очистить поле" DTO не поддерживает (см. Global Constraints)
          name: name.trim() || undefined,
          description: description.trim() || undefined,
          warrantyEndsAt: warrantyEndsAt || undefined,
        },
      });
      setIsExpanded(false);
    } catch {
      toast.danger('Не удалось сохранить документ');
    }
  };

  const handleDelete = async () => {
    try {
      await deleteDocument({ id: doc.id, itemId: doc.itemId });
      deleteState.close();
    } catch {
      toast.danger('Не удалось удалить документ');
    }
  };

  const Icon = doc.file.mimeType === 'application/pdf' ? FileText : ImageIcon;
  const warrantyColorClass = getWarrantyColorClass(doc.warrantyEndsAt);
  const title = doc.name || `Документ (${DOCUMENT_TYPE_LABELS[doc.type]})`;

  return (
    <div className='flex flex-col gap-3 rounded-lg border border-border p-3'>
      <div className='flex items-center gap-3'>
        <a
          href={doc.file.url}
          target='_blank'
          rel='noreferrer'
          aria-label='Открыть файл'
          className='flex size-9 shrink-0 items-center justify-center rounded-lg bg-surface-secondary text-muted transition-colors hover:text-primary'
        >
          <Icon size={18} />
        </a>

        <button
          type='button'
          onClick={() => (isExpanded ? setIsExpanded(false) : handleExpand())}
          className='flex flex-1 flex-col items-start gap-1 text-left'
        >
          <div className='flex items-center gap-2'>
            <Typography type='body-sm' weight='medium'>
              {title}
            </Typography>
            <Chip size='sm'>{DOCUMENT_TYPE_LABELS[doc.type]}</Chip>
          </div>

          {doc.warrantyEndsAt && (
            <Typography type='body-xs' className={warrantyColorClass}>
              Гарантия до{' '}
              {new Date(doc.warrantyEndsAt).toLocaleDateString('ru-RU')}
            </Typography>
          )}
        </button>

        <button
          type='button'
          aria-label='Удалить документ'
          onClick={deleteState.open}
          className='flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-secondary hover:text-danger'
        >
          <Trash2 size={16} />
        </button>
      </div>

      {isExpanded && (
        <div className='flex flex-col gap-3 border-t border-border pt-3'>
          <SelectField
            label='Тип'
            placeholder='Тип документа'
            value={type}
            onChange={value => setType(value as DocumentType)}
            options={TYPE_OPTIONS}
          />

          <TextField
            className='flex flex-col gap-1'
            value={name}
            onChange={setName}
          >
            <Label>Имя</Label>
            <Input placeholder='Необязательно' />
          </TextField>

          <TextField
            className='flex flex-col gap-1'
            value={description}
            onChange={setDescription}
          >
            <Label>Описание</Label>
            <TextArea placeholder='Необязательно' />
          </TextField>

          <TextField
            type='date'
            className='flex flex-col gap-1'
            value={warrantyEndsAt}
            onChange={setWarrantyEndsAt}
          >
            <Label>Гарантия до</Label>
            <Input />
          </TextField>

          <div className='flex justify-end gap-2'>
            <Button
              type='button'
              variant='ghost'
              size='sm'
              onPress={() => setIsExpanded(false)}
            >
              Отмена
            </Button>
            <Button
              type='button'
              size='sm'
              isDisabled={isSaving}
              onPress={() => void handleSave()}
            >
              {isSaving ? <Spinner size='sm' /> : 'Сохранить'}
            </Button>
          </div>
        </div>
      )}

      <AlertDialog.Root
        isOpen={deleteState.isOpen}
        onOpenChange={deleteState.setOpen}
      >
        <AlertDialog.Backdrop>
          <AlertDialog.Container>
            <AlertDialog.Dialog>
              <div className='flex items-center gap-3'>
                <AlertDialog.Icon />
                <AlertDialog.Header className='mb-0'>
                  <AlertDialog.Heading>Удалить документ?</AlertDialog.Heading>
                </AlertDialog.Header>
              </div>
              <AlertDialog.Body className='mt-2'>
                Это действие нельзя отменить.
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button
                  type='button'
                  variant='ghost'
                  onPress={deleteState.close}
                >
                  Отмена
                </Button>
                <Button
                  type='button'
                  variant='danger'
                  isDisabled={isDeleting}
                  onPress={() => void handleDelete()}
                >
                  Удалить
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog.Root>
    </div>
  );
}
```

- [ ] Verify: `cd fe && bun run build && bun run lint` — clean (still unused by any page — that's Task 4).

### Task 3: `DocumentList` UI + `features/document` barrel

**Files:**
- Create: `fe/src/features/document/ui/document-list.tsx`
- Create: `fe/src/features/document/index.ts`

**Interfaces:**
- Consumes: `documentQueries` (Task 1), `DocumentCard` (Task 2), `EmptyState`/`ErrorState`/`Skeleton`/`Spinner`/`Typography`/`toast` (`@/shared/ui`).
- Produces: `<DocumentList itemId={string} />`.

- [ ] Create `fe/src/features/document/ui/document-list.tsx`:

```tsx
import { useRef, useState } from 'react';

import { useMutation, useQuery } from '@tanstack/react-query';
import { FileStack, Plus } from 'lucide-react';

import { documentQueries } from '@/services/document';

import {
  EmptyState,
  ErrorState,
  Skeleton,
  Spinner,
  Typography,
  toast,
} from '@/shared/ui';

import { DocumentCard } from './document-card';

const ACCEPTED_DOCUMENT_MIME_TYPES =
  'application/pdf,image/jpeg,image/png,image/webp';

interface Props {
  itemId: string;
}

export function DocumentList(props: Props) {
  const { itemId } = props;

  const {
    data: documents,
    isPending,
    isError,
    refetch,
  } = useQuery(documentQueries.byItem(itemId));

  const [uploadingCount, setUploadingCount] = useState(0);

  const { mutateAsync: uploadFile } = useMutation(documentQueries.uploadFile());
  const { mutateAsync: createDocument } = useMutation(documentQueries.create());

  const inputRef = useRef<HTMLInputElement>(null);

  const handleFiles = (files: FileList | null) => {
    if (!files) return;

    Array.from(files).forEach(file => {
      setUploadingCount(count => count + 1);

      uploadFile(file)
        .then(uploaded =>
          createDocument({ itemId, type: 'other', fileKey: uploaded.key }),
        )
        .catch(() => {
          toast.danger(`Не удалось загрузить документ: ${file.name}`);
        })
        .finally(() => {
          setUploadingCount(count => count - 1);
        });
    });
  };

  return (
    <div className='flex w-full flex-col gap-3 rounded-2xl border border-border bg-surface p-10 shadow-xl'>
      <div className='flex items-center justify-between'>
        <Typography type='h4'>Документы</Typography>

        <button
          type='button'
          onClick={() => inputRef.current?.click()}
          className='flex items-center gap-1 text-sm text-primary hover:underline'
        >
          <Plus size={16} />
          Добавить документ
        </button>

        <input
          ref={inputRef}
          type='file'
          accept={ACCEPTED_DOCUMENT_MIME_TYPES}
          multiple
          className='hidden'
          onChange={e => {
            handleFiles(e.target.files);
            e.target.value = '';
          }}
        />
      </div>

      {isPending && (
        <div className='flex flex-col gap-2'>
          <Skeleton className='h-16 w-full rounded-lg' />
          <Skeleton className='h-16 w-full rounded-lg' />
        </div>
      )}

      {isError && (
        <ErrorState onRetry={() => refetch()}>
          Не удалось загрузить документы
        </ErrorState>
      )}

      {!isPending && !isError && documents && (
        <div className='flex flex-col gap-2'>
          {documents.map(doc => (
            <DocumentCard key={doc.id} doc={doc} />
          ))}

          {Array.from({ length: uploadingCount }).map((_, index) => (
            <div
              key={`pending-${index}`}
              className='flex h-16 items-center justify-center rounded-lg border border-dashed border-border'
            >
              <Spinner size='sm' />
            </div>
          ))}

          {documents.length === 0 && uploadingCount === 0 && (
            <EmptyState icon={FileStack}>Документов пока нет</EmptyState>
          )}
        </div>
      )}
    </div>
  );
}
```

- [ ] Create `fe/src/features/document/index.ts`:

```ts
export { DocumentList } from './ui/document-list';
```

- [ ] Verify: `cd fe && bun run build && bun run lint` — clean (still unused by any page — that's Task 4).

### Task 4: Wire into `item.tsx` + final verification

**Files:**
- Modify: `fe/src/features/item/ui/item.tsx`

**Interfaces:**
- Consumes: `DocumentList` (Task 3, `@/features/document`).

- [ ] Modify `fe/src/features/item/ui/item.tsx`:
  - Add the import, alphabetically before the existing `ItemDeleteTrigger` import:
    ```ts
    import { DocumentList } from '@/features/document';
    import { ItemDeleteTrigger } from '@/features/item-delete';
    ```
  - In the success-path `return`, add `<DocumentList itemId={item.id} />` as a sibling right after the existing edit-form card `</div>`, still inside the top-level `<>...</>` fragment:
    ```tsx
      <div className='flex w-full flex-col gap-4 rounded-2xl border border-border bg-surface p-10 shadow-xl'>
        <ItemEditForm
          item={item}
          containerId={item.containerId}
          categorySlot={categorySlot}
        />
      </div>

      <DocumentList itemId={item.id} />
    </>
    ```

- [ ] Verify build/lint: `cd fe && bun run build && bun run lint` — clean.
- [ ] Manual browser walkthrough (start backend + frontend dev servers, open an existing item's detail page):
  1. Confirm a "Документы" section renders below the item edit-form card, showing "Документов пока нет" on an item with none.
  2. Click "Добавить документ", pick a PDF file. Confirm a spinner placeholder appears briefly, then a card appears showing the filename, a "Другое" type badge, and the file-icon link.
  3. Pick an image file (jpg/png/webp) the same way. Confirm its card shows the image icon (visually distinct from the PDF's file icon).
  4. Click the PDF card to expand it. Change the type to "Чек", set a name, a description, and a warranty date about 3 months out. Click "Сохранить". Confirm the card collapses and now shows the new name and "Чек" badge, with the warranty date in normal (non-colored) text.
  5. Expand the same card again, change the warranty date to ~15 days from today, save. Confirm the date text renders in the amber/warning color.
  6. Expand again, change the warranty date to yesterday (or any past date), save. Confirm the date text renders in red/danger color.
  7. Click the file-icon link on any card. Confirm it opens the file in a new browser tab.
  8. Click the trash icon on a card. Confirm the `AlertDialog` confirmation appears; confirm deletion removes the card from the list.
  9. Delete the remaining document and confirm the section returns to the "Документов пока нет" empty state.
