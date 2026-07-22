# Item Photos Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user attach photos to an item from its detail page — upload, view full-size, drag-to-reorder, and remove — all saved together with the rest of the item form via the existing "Сохранить" button.

**Architecture:** `photos` becomes a `string[]` (storage keys) field on the existing `ItemEditForm` tanstack-form, submitted with everything else on one PATCH. A new `ItemPhotosField` owns a thumbnail grid (upload, delete, `@dnd-kit` drag-reorder) rendered inside the form's existing card, plus a local render-only `Record<key, ItemPhotoResponseDto>` cache seeded from the item's current photos and appended to as uploads complete. A new `PhotoLightbox` handles full-size viewing. No backend changes — `POST /items/photo` and `PATCH /items/:id`'s `photos: string[]` field already cover everything.

**Tech Stack:** React + TanStack Form/Query + HeroUI + `@dnd-kit` (new dependency) — frontend only.

## Global Constraints

- All commands run from `fe/`: `bun run build`, `bun run lint`.
- Frontend types come from `@/kernel/api/schema` (`components['schemas'][...]`) — already up to date, no backend changes in this plan.
- New dependency: `@dnd-kit/core`, `@dnd-kit/sortable`, `@dnd-kit/utilities`, installed via `bun add` (no drag-and-drop library exists in the project yet).
- User-facing copy is in Russian, matching every existing feature.
- No unit-test runner on the frontend — verification is `bun run build` + `bun run lint` + one manual browser walkthrough per task where relevant (per project convention: one targeted pass, not exhaustive regression sweeps).
- Toast conventions unchanged (`toast.success`/`toast.danger`).
- Import order is enforced by `@trivago/prettier-plugin-sort-imports` (`.prettierrc`): react → external packages → `@/app` → `@/pages` → `@/features` → `@/services` → `@/kernel` → `@/shared` → relative — auto-fixed by the project's commit hook, but write it correctly.
- Photos are only manageable from an already-created item's detail page — `create-item-form.tsx` is out of scope and untouched by this plan.

---

### Task 1: Upload endpoint + `photos` field plumbing

**Files:**
- Modify: `fe/package.json` (via `bun add`)
- Create: `fe/src/services/item/api/upload-photo.ts`
- Modify: `fe/src/services/item/api/item.queries.ts`
- Modify: `fe/src/features/item/model/schemas.ts`
- Modify: `fe/src/features/item/model/use-item-edit-form.ts`

**Interfaces:**
- Consumes: `apiClient` (`@/shared/api/api-client`), `components['schemas']['ItemPhotoResponseDto']`/`ItemResponseDto` (`@/kernel/api/schema`), existing `itemQueries` object and `itemEditSchema`/`useItemEditForm`.
- Produces: `uploadItemPhotoRequest(file: File): Promise<ItemPhotoResponseDto>`, `itemQueries.uploadPhoto()` (mutationOptions, no cache invalidation), `itemEditSchema` gains `photos: z.array(z.string())`, `useItemEditForm`'s form gains a `photos` field (default `item.photos.map(p => p.key)`) and submits `photos: value.photos`. Consumed by Task 2's `ItemPhotosField` and `ItemEditForm`.

- [ ] **Step 1: Install `@dnd-kit`**

Run (from `fe/`): `bun add @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities`
Expected: `package.json`/`bun.lock` updated, no install errors. Not consumed until Task 3, but installed now alongside the rest of this task's plumbing.

- [ ] **Step 2: Upload request function**

```ts
// fe/src/services/item/api/upload-photo.ts
import type { components } from '@/kernel/api/schema';
import { apiClient } from '@/shared/api/api-client';

type ItemPhotoResponseDto = components['schemas']['ItemPhotoResponseDto'];

export async function uploadItemPhotoRequest(
  file: File,
): Promise<ItemPhotoResponseDto> {
  const formData = new FormData();
  formData.append('file', file);

  const { data, error } = await apiClient.POST('/api/v1/items/photo', {
    // openapi-fetch пропускает FormData как есть, минуя JSON-сериализацию;
    // сгенерированный тип тела ({file?: string}) этого не отражает
    body: formData as never,
  });

  if (error) throw error;

  return data!;
}
```

- [ ] **Step 3: Add `uploadPhoto` mutation to `itemQueries`**

```ts
// fe/src/services/item/api/item.queries.ts
import { mutationOptions, queryOptions } from '@tanstack/react-query';

import { buildItemByIdKey, buildItemsByContainerKey } from '@/kernel/item/keys';

import type { components } from '@/kernel/api/schema';
import { queryClient } from '@/shared/api/query-client';

import { createItemRequest } from './create';
import { deleteItemRequest } from './delete';
import { findItemByIdRequest } from './find-by-id';
import { findItemsByContainerRequest } from './find-by-container';
import { updateItemRequest } from './update';
import { uploadItemPhotoRequest } from './upload-photo';

type UpdateItemDto = components['schemas']['UpdateItemDto'];

export const itemQueries = {
  byContainer: (containerId: string) =>
    queryOptions({
      queryKey: buildItemsByContainerKey(containerId),
      queryFn: () => findItemsByContainerRequest(containerId),
    }),

  byId: (id: string) =>
    queryOptions({
      queryKey: buildItemByIdKey(id),
      queryFn: () => findItemByIdRequest(id),
    }),

  create: () =>
    mutationOptions({
      mutationFn: createItemRequest,
      onSuccess: data => {
        queryClient.invalidateQueries({
          queryKey: buildItemsByContainerKey(data.containerId),
        });
      },
    }),

  update: () =>
    mutationOptions({
      mutationFn: (vars: {
        id: string;
        containerId: string;
        dto: UpdateItemDto;
      }) => updateItemRequest(vars.id, vars.dto),
      onSuccess: (_data, vars) => {
        queryClient.invalidateQueries({
          queryKey: buildItemsByContainerKey(vars.containerId),
        });
        queryClient.invalidateQueries({
          queryKey: buildItemByIdKey(vars.id),
        });
      },
    }),

  delete: () =>
    mutationOptions({
      mutationFn: (vars: { id: string; containerId: string }) =>
        deleteItemRequest(vars.id),
      onSuccess: (_data, vars) => {
        queryClient.invalidateQueries({
          queryKey: buildItemsByContainerKey(vars.containerId),
        });
      },
    }),

  uploadPhoto: () =>
    mutationOptions({
      mutationFn: uploadItemPhotoRequest,
    }),
};
```

(only the `uploadItemPhotoRequest` import and the `uploadPhoto` entry are new — `byContainer`/`byId`/`create`/`update`/`delete` are unchanged)

- [ ] **Step 4: Extend `itemEditSchema` and `useItemEditForm`**

```ts
// fe/src/features/item/model/schemas.ts
import { z } from 'zod';

export const itemEditSchema = z.object({
  name: z.string().min(1, 'Поле обязательно').max(256, 'Слишком длинное имя'),
  categoryId: z.string(),
  quantity: z
    .string()
    .regex(/^\d+$/, 'Введите целое число')
    .refine(v => Number(v) >= 1, 'Минимум 1'),
  description: z.string().max(2048, 'Слишком длинное описание'),
  photos: z.array(z.string()),
});
```

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

(only `photos` in `defaultValues` and in the `updateItem` payload are new)

- [ ] **Step 5: Typecheck + lint**

Run (from `fe/`): `bun run build && bun run lint`
Expected: no errors. `photos` isn't rendered by any field in `ItemEditForm` yet, so no manual check here — tanstack-form tolerates an unrendered field in `defaultValues`.

- [ ] **Step 6: Commit**

```bash
git add fe/package.json fe/bun.lock fe/src/services/item/api/upload-photo.ts fe/src/services/item/api/item.queries.ts fe/src/features/item/model/schemas.ts fe/src/features/item/model/use-item-edit-form.ts
git commit -m "feat(fe): item photo upload endpoint + photos field plumbing"
```

---

### Task 2: `ItemPhotosField` — grid, upload, delete

**Files:**
- Create: `fe/src/features/item/ui/item-photos-field.tsx`
- Modify: `fe/src/features/item/ui/item-edit-form.tsx`

**Interfaces:**
- Consumes: `itemQueries.uploadPhoto()` (Task 1), `field: AnyFieldApi` for the `photos` field (Task 1), `ItemPhotoResponseDto` (`@/kernel/api/schema`).
- Produces: `ItemPhotosField({ field, initialPhotos, onUploadingChange })` — renders the grid and calls `onUploadingChange(count: number)` whenever the number of in-flight uploads changes. Consumed by `ItemEditForm` (this task) and extended in Task 3 (drag-and-drop) and Task 4 (lightbox) without changing this signature.

- [ ] **Step 1: Build the field component**

```tsx
// fe/src/features/item/ui/item-photos-field.tsx
import { useEffect, useState } from 'react';

import type { AnyFieldApi } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import { Plus, X } from 'lucide-react';

import { itemQueries } from '@/services/item';

import type { components } from '@/kernel/api/schema';

import { Label, Spinner, toast } from '@/shared/ui';

type ItemPhotoResponseDto = components['schemas']['ItemPhotoResponseDto'];

interface Props {
  field: AnyFieldApi;
  initialPhotos: ItemPhotoResponseDto[];
  onUploadingChange: (count: number) => void;
}

export function ItemPhotosField(props: Props) {
  const { field, initialPhotos, onUploadingChange } = props;

  const [photoMeta, setPhotoMeta] = useState<
    Record<string, ItemPhotoResponseDto>
  >(() => Object.fromEntries(initialPhotos.map(photo => [photo.key, photo])));
  const [pendingCount, setPendingCount] = useState(0);

  const { mutateAsync: uploadPhoto } = useMutation(itemQueries.uploadPhoto());

  useEffect(() => {
    onUploadingChange(pendingCount);
  }, [pendingCount, onUploadingChange]);

  const handleFilesSelected = (files: FileList | null) => {
    if (!files) return;

    Array.from(files).forEach(file => {
      setPendingCount(count => count + 1);

      uploadPhoto(file)
        .then(photo => {
          setPhotoMeta(meta => ({ ...meta, [photo.key]: photo }));
          field.handleChange((keys: string[]) => [...keys, photo.key]);
        })
        .catch(() => {
          toast.danger(`Не удалось загрузить фото: ${file.name}`);
        })
        .finally(() => {
          setPendingCount(count => count - 1);
        });
    });
  };

  const handleDelete = (key: string) => {
    field.handleChange((keys: string[]) => keys.filter(k => k !== key));
  };

  const attachedKeys: string[] = field.state.value;

  return (
    <div className='flex flex-col gap-2'>
      <Label>Фото</Label>

      <div className='flex flex-wrap gap-3'>
        {attachedKeys.map(key => {
          const photo = photoMeta[key];
          if (!photo) return null;

          return (
            <div
              key={key}
              className='group relative size-24 shrink-0 overflow-hidden rounded-lg border border-border'
            >
              <img src={photo.url} alt='' className='size-full object-cover' />

              <button
                type='button'
                aria-label='Удалить фото'
                onClick={() => handleDelete(key)}
                className='absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-surface/80 text-muted opacity-0 transition-opacity hover:text-danger group-hover:opacity-100'
              >
                <X size={14} />
              </button>
            </div>
          );
        })}

        {Array.from({ length: pendingCount }).map((_, index) => (
          <div
            key={`pending-${index}`}
            className='flex size-24 shrink-0 items-center justify-center rounded-lg border border-border'
          >
            <Spinner size='sm' />
          </div>
        ))}

        <label className='flex size-24 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-dashed border-border text-muted transition-colors hover:border-primary hover:text-primary'>
          <Plus size={20} />
          <input
            type='file'
            accept='image/jpeg,image/png,image/webp'
            multiple
            className='hidden'
            onChange={e => {
              handleFilesSelected(e.target.files);
              e.target.value = '';
            }}
          />
        </label>
      </div>
    </div>
  );
}
```

Note on correctness: `field.handleChange` is called with a functional updater (`(keys: string[]) => ...`), not a plain new array — tanstack-form's `handleChange` accepts `Updater<TData> = TData | ((prev: TData) => TData)` (confirmed in `@tanstack/form-core`'s `FieldApi.d.ts`/`utils.d.ts`). This matters because multiple uploads can resolve close together; reading `field.state.value` at call time and computing off a stale snapshot would silently drop keys when two uploads finish within the same tick. The functional form always applies against the latest value.

- [ ] **Step 2: Wire into `ItemEditForm`**

```tsx
// fe/src/features/item/ui/item-edit-form.tsx
import { useState } from 'react';

import { useQuery } from '@tanstack/react-query';

import { categoryQueries } from '@/services/category';

import type { components } from '@/kernel/api/schema';

import {
  Button,
  FormTextareaField,
  FormTextField,
  SelectField,
  Spinner,
} from '@/shared/ui';

import { useItemEditForm } from '../model/use-item-edit-form';
import { ItemPhotosField } from './item-photos-field';

type ItemResponseDto = components['schemas']['ItemResponseDto'];

interface Props {
  item: ItemResponseDto;
  containerId: string;
}

export function ItemEditForm({ item, containerId }: Props) {
  const { form } = useItemEditForm({ item, containerId });
  const { data: categories } = useQuery(categoryQueries.list());
  const [uploadingCount, setUploadingCount] = useState(0);

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
          <ItemPhotosField
            field={field}
            initialPhotos={item.photos}
            onUploadingChange={setUploadingCount}
          />
        )}
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
            className='self-start'
          >
            {isSubmitting ? <Spinner /> : 'Сохранить'}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
```

(new: `useState` import, `uploadingCount` state, the `photos` `form.Field` block, `ItemPhotosField` import, and `uploadingCount > 0` in the submit's `isDisabled`)

- [ ] **Step 3: Typecheck + lint**

Run (from `fe/`): `bun run build && bun run lint`
Expected: no errors.

- [ ] **Step 4: Manual check**

Open an item's detail page. Confirm a "Фото" block renders below "Описание" inside the same card, with a dashed "+" tile. Click it, select 1–2 images (jpeg/png/webp) — each shows a spinner tile while uploading, then becomes a real thumbnail; "Сохранить" is disabled while any upload is in flight. Click a thumbnail's "×" to remove it (grid updates immediately, nothing hits the network yet). Click "Сохранить" — confirm success toast. Reload the page and confirm the photos you kept are still there (and the deleted one is gone). Try uploading a non-image file (e.g. a `.txt` renamed to bypass the picker, or a file over 10MB) and confirm a `toast.danger` with no thumbnail added.

- [ ] **Step 5: Commit**

```bash
git add fe/src/features/item/ui/item-photos-field.tsx fe/src/features/item/ui/item-edit-form.tsx
git commit -m "feat(fe): photo grid — upload and delete"
```

---

### Task 3: Drag-and-drop reorder

**Files:**
- Modify: `fe/src/features/item/ui/item-photos-field.tsx`

**Interfaces:**
- Consumes: `@dnd-kit/core` (`DndContext`, `PointerSensor`, `useSensor`, `useSensors`, `DragEndEvent`), `@dnd-kit/sortable` (`SortableContext`, `arrayMove`, `rectSortingStrategy`, `useSortable`), `@dnd-kit/utilities` (`CSS`) — all installed in Task 1. Consumes `cn` from `@/shared/lib/cn`.
- Produces: photo tiles are now draggable via a dedicated grip handle (not the whole tile, so click-to-open in Task 4 doesn't conflict with drag) and reorder `field.state.value` on drop. `ItemPhotosField`'s external props are unchanged.

- [ ] **Step 1: Extract a sortable thumbnail and wrap the grid in `DndContext`**

```tsx
// fe/src/features/item/ui/item-photos-field.tsx
import { useEffect, useState } from 'react';

import type { AnyFieldApi } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, X } from 'lucide-react';

import { itemQueries } from '@/services/item';

import type { components } from '@/kernel/api/schema';

import { cn } from '@/shared/lib/cn';
import { Label, Spinner, toast } from '@/shared/ui';

type ItemPhotoResponseDto = components['schemas']['ItemPhotoResponseDto'];

interface Props {
  field: AnyFieldApi;
  initialPhotos: ItemPhotoResponseDto[];
  onUploadingChange: (count: number) => void;
}

interface ThumbnailProps {
  photo: ItemPhotoResponseDto;
  onDelete: () => void;
}

function SortablePhotoThumbnail(props: ThumbnailProps) {
  const { photo, onDelete } = props;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: photo.key });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'group relative size-24 shrink-0 overflow-hidden rounded-lg border border-border',
        isDragging && 'opacity-50',
      )}
    >
      <img src={photo.url} alt='' className='size-full object-cover' />

      <button
        type='button'
        aria-label='Переместить фото'
        {...attributes}
        {...listeners}
        className='absolute left-1 top-1 flex size-6 cursor-grab items-center justify-center rounded-full bg-surface/80 text-muted opacity-0 transition-opacity active:cursor-grabbing group-hover:opacity-100'
      >
        <GripVertical size={14} />
      </button>

      <button
        type='button'
        aria-label='Удалить фото'
        onClick={onDelete}
        className='absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-surface/80 text-muted opacity-0 transition-opacity hover:text-danger group-hover:opacity-100'
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function ItemPhotosField(props: Props) {
  const { field, initialPhotos, onUploadingChange } = props;

  const [photoMeta, setPhotoMeta] = useState<
    Record<string, ItemPhotoResponseDto>
  >(() => Object.fromEntries(initialPhotos.map(photo => [photo.key, photo])));
  const [pendingCount, setPendingCount] = useState(0);

  const { mutateAsync: uploadPhoto } = useMutation(itemQueries.uploadPhoto());

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  useEffect(() => {
    onUploadingChange(pendingCount);
  }, [pendingCount, onUploadingChange]);

  const handleFilesSelected = (files: FileList | null) => {
    if (!files) return;

    Array.from(files).forEach(file => {
      setPendingCount(count => count + 1);

      uploadPhoto(file)
        .then(photo => {
          setPhotoMeta(meta => ({ ...meta, [photo.key]: photo }));
          field.handleChange((keys: string[]) => [...keys, photo.key]);
        })
        .catch(() => {
          toast.danger(`Не удалось загрузить фото: ${file.name}`);
        })
        .finally(() => {
          setPendingCount(count => count - 1);
        });
    });
  };

  const handleDelete = (key: string) => {
    field.handleChange((keys: string[]) => keys.filter(k => k !== key));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    field.handleChange((keys: string[]) => {
      const oldIndex = keys.indexOf(String(active.id));
      const newIndex = keys.indexOf(String(over.id));
      return arrayMove(keys, oldIndex, newIndex);
    });
  };

  const attachedKeys: string[] = field.state.value;

  return (
    <div className='flex flex-col gap-2'>
      <Label>Фото</Label>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <SortableContext items={attachedKeys} strategy={rectSortingStrategy}>
          <div className='flex flex-wrap gap-3'>
            {attachedKeys.map(key => {
              const photo = photoMeta[key];
              if (!photo) return null;

              return (
                <SortablePhotoThumbnail
                  key={key}
                  photo={photo}
                  onDelete={() => handleDelete(key)}
                />
              );
            })}

            {Array.from({ length: pendingCount }).map((_, index) => (
              <div
                key={`pending-${index}`}
                className='flex size-24 shrink-0 items-center justify-center rounded-lg border border-border'
              >
                <Spinner size='sm' />
              </div>
            ))}

            <label className='flex size-24 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-dashed border-border text-muted transition-colors hover:border-primary hover:text-primary'>
              <Plus size={20} />
              <input
                type='file'
                accept='image/jpeg,image/png,image/webp'
                multiple
                className='hidden'
                onChange={e => {
                  handleFilesSelected(e.target.files);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
        </SortableContext>
      </DndContext>
    </div>
  );
}
```

(new: the `@dnd-kit/*` imports, `cn` import, the `SortablePhotoThumbnail` sub-component with a dedicated grip handle, `sensors`/`handleDragEnd`, and the `DndContext`/`SortableContext` wrapper around the grid. The thumbnail's delete button and markup are otherwise unchanged from Task 2; the click-to-open-lightbox handler is added in Task 4)

- [ ] **Step 2: Typecheck + lint**

Run (from `fe/`): `bun run build && bun run lint`
Expected: no errors.

- [ ] **Step 3: Manual check**

Open an item with 3+ photos (upload a couple more if needed, save). Hover a thumbnail — confirm a grip handle appears top-left (distinct from the "×" top-right). Drag a thumbnail by its grip handle to a different position — confirm the grid reorders immediately (client-side, no network yet). Click "Сохранить", reload the page, and confirm the new order persisted. Confirm a plain click on the thumbnail (not the grip) does not start a drag and does not error (lightbox isn't wired yet, so nothing should happen on click in this task).

- [ ] **Step 4: Commit**

```bash
git add fe/src/features/item/ui/item-photos-field.tsx
git commit -m "feat(fe): drag-and-drop photo reorder"
```

---

### Task 4: `PhotoLightbox` — full-size viewing

**Files:**
- Create: `fe/src/features/item/ui/photo-lightbox.tsx`
- Modify: `fe/src/features/item/ui/item-photos-field.tsx`

**Interfaces:**
- Consumes: `ItemPhotoResponseDto` (`@/kernel/api/schema`).
- Produces: `PhotoLightbox({ photos, index, onClose, onNavigate })` — controlled full-screen viewer. `ItemPhotosField` gains internal `lightboxIndex` state and wires thumbnail clicks to it; its external props (`field`, `initialPhotos`, `onUploadingChange`) are unchanged.

- [ ] **Step 1: Build the lightbox**

```tsx
// fe/src/features/item/ui/photo-lightbox.tsx
import { useEffect } from 'react';

import { ChevronLeft, ChevronRight, X } from 'lucide-react';

import type { components } from '@/kernel/api/schema';

type ItemPhotoResponseDto = components['schemas']['ItemPhotoResponseDto'];

interface Props {
  photos: ItemPhotoResponseDto[];
  index: number;
  onClose: () => void;
  onNavigate: (index: number) => void;
}

export function PhotoLightbox(props: Props) {
  const { photos, index, onClose, onNavigate } = props;

  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
      if (e.key === 'ArrowLeft') {
        onNavigate((index - 1 + photos.length) % photos.length);
      }
      if (e.key === 'ArrowRight') {
        onNavigate((index + 1) % photos.length);
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [index, photos.length, onClose, onNavigate]);

  const photo = photos[index];
  if (!photo) return null;

  return (
    <div
      className='fixed inset-0 z-50 flex items-center justify-center bg-black/90'
      onClick={onClose}
    >
      <button
        type='button'
        aria-label='Закрыть'
        onClick={onClose}
        className='absolute right-4 top-4 flex size-10 items-center justify-center rounded-full text-white/80 transition-colors hover:text-white'
      >
        <X size={24} />
      </button>

      {photos.length > 1 && (
        <button
          type='button'
          aria-label='Предыдущее фото'
          onClick={e => {
            e.stopPropagation();
            onNavigate((index - 1 + photos.length) % photos.length);
          }}
          className='absolute left-4 flex size-10 items-center justify-center rounded-full text-white/80 transition-colors hover:text-white'
        >
          <ChevronLeft size={28} />
        </button>
      )}

      <img
        src={photo.url}
        alt=''
        className='max-h-[85vh] max-w-[85vw] object-contain'
        onClick={e => e.stopPropagation()}
      />

      {photos.length > 1 && (
        <button
          type='button'
          aria-label='Следующее фото'
          onClick={e => {
            e.stopPropagation();
            onNavigate((index + 1) % photos.length);
          }}
          className='absolute right-4 flex size-10 items-center justify-center rounded-full text-white/80 transition-colors hover:text-white'
        >
          <ChevronRight size={28} />
        </button>
      )}
    </div>
  );
}
```

- [ ] **Step 2: Wire click-to-open into `ItemPhotosField`**

```tsx
// fe/src/features/item/ui/item-photos-field.tsx
import { useEffect, useState } from 'react';

import type { AnyFieldApi } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';
import {
  DndContext,
  PointerSensor,
  useSensor,
  useSensors,
  type DragEndEvent,
} from '@dnd-kit/core';
import {
  SortableContext,
  arrayMove,
  rectSortingStrategy,
  useSortable,
} from '@dnd-kit/sortable';
import { CSS } from '@dnd-kit/utilities';
import { GripVertical, Plus, X } from 'lucide-react';

import { itemQueries } from '@/services/item';

import type { components } from '@/kernel/api/schema';

import { cn } from '@/shared/lib/cn';
import { Label, Spinner, toast } from '@/shared/ui';

import { PhotoLightbox } from './photo-lightbox';

type ItemPhotoResponseDto = components['schemas']['ItemPhotoResponseDto'];

interface Props {
  field: AnyFieldApi;
  initialPhotos: ItemPhotoResponseDto[];
  onUploadingChange: (count: number) => void;
}

interface ThumbnailProps {
  photo: ItemPhotoResponseDto;
  onOpen: () => void;
  onDelete: () => void;
}

function SortablePhotoThumbnail(props: ThumbnailProps) {
  const { photo, onOpen, onDelete } = props;

  const { attributes, listeners, setNodeRef, transform, transition, isDragging } =
    useSortable({ id: photo.key });

  return (
    <div
      ref={setNodeRef}
      style={{ transform: CSS.Transform.toString(transform), transition }}
      className={cn(
        'group relative size-24 shrink-0 overflow-hidden rounded-lg border border-border',
        isDragging && 'opacity-50',
      )}
    >
      <button type='button' onClick={onOpen} className='size-full'>
        <img src={photo.url} alt='' className='size-full object-cover' />
      </button>

      <button
        type='button'
        aria-label='Переместить фото'
        {...attributes}
        {...listeners}
        className='absolute left-1 top-1 flex size-6 cursor-grab items-center justify-center rounded-full bg-surface/80 text-muted opacity-0 transition-opacity active:cursor-grabbing group-hover:opacity-100'
      >
        <GripVertical size={14} />
      </button>

      <button
        type='button'
        aria-label='Удалить фото'
        onClick={onDelete}
        className='absolute right-1 top-1 flex size-6 items-center justify-center rounded-full bg-surface/80 text-muted opacity-0 transition-opacity hover:text-danger group-hover:opacity-100'
      >
        <X size={14} />
      </button>
    </div>
  );
}

export function ItemPhotosField(props: Props) {
  const { field, initialPhotos, onUploadingChange } = props;

  const [photoMeta, setPhotoMeta] = useState<
    Record<string, ItemPhotoResponseDto>
  >(() => Object.fromEntries(initialPhotos.map(photo => [photo.key, photo])));
  const [pendingCount, setPendingCount] = useState(0);
  const [lightboxIndex, setLightboxIndex] = useState<number | null>(null);

  const { mutateAsync: uploadPhoto } = useMutation(itemQueries.uploadPhoto());

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
  );

  useEffect(() => {
    onUploadingChange(pendingCount);
  }, [pendingCount, onUploadingChange]);

  const handleFilesSelected = (files: FileList | null) => {
    if (!files) return;

    Array.from(files).forEach(file => {
      setPendingCount(count => count + 1);

      uploadPhoto(file)
        .then(photo => {
          setPhotoMeta(meta => ({ ...meta, [photo.key]: photo }));
          field.handleChange((keys: string[]) => [...keys, photo.key]);
        })
        .catch(() => {
          toast.danger(`Не удалось загрузить фото: ${file.name}`);
        })
        .finally(() => {
          setPendingCount(count => count - 1);
        });
    });
  };

  const handleDelete = (key: string) => {
    field.handleChange((keys: string[]) => keys.filter(k => k !== key));
  };

  const handleDragEnd = (event: DragEndEvent) => {
    const { active, over } = event;
    if (!over || active.id === over.id) return;

    field.handleChange((keys: string[]) => {
      const oldIndex = keys.indexOf(String(active.id));
      const newIndex = keys.indexOf(String(over.id));
      return arrayMove(keys, oldIndex, newIndex);
    });
  };

  const attachedKeys: string[] = field.state.value;
  const attachedPhotos = attachedKeys
    .map(key => photoMeta[key])
    .filter((photo): photo is ItemPhotoResponseDto => Boolean(photo));

  return (
    <div className='flex flex-col gap-2'>
      <Label>Фото</Label>

      <DndContext sensors={sensors} onDragEnd={handleDragEnd}>
        <SortableContext items={attachedKeys} strategy={rectSortingStrategy}>
          <div className='flex flex-wrap gap-3'>
            {attachedKeys.map((key, index) => {
              const photo = photoMeta[key];
              if (!photo) return null;

              return (
                <SortablePhotoThumbnail
                  key={key}
                  photo={photo}
                  onOpen={() => setLightboxIndex(index)}
                  onDelete={() => handleDelete(key)}
                />
              );
            })}

            {Array.from({ length: pendingCount }).map((_, index) => (
              <div
                key={`pending-${index}`}
                className='flex size-24 shrink-0 items-center justify-center rounded-lg border border-border'
              >
                <Spinner size='sm' />
              </div>
            ))}

            <label className='flex size-24 shrink-0 cursor-pointer items-center justify-center rounded-lg border border-dashed border-border text-muted transition-colors hover:border-primary hover:text-primary'>
              <Plus size={20} />
              <input
                type='file'
                accept='image/jpeg,image/png,image/webp'
                multiple
                className='hidden'
                onChange={e => {
                  handleFilesSelected(e.target.files);
                  e.target.value = '';
                }}
              />
            </label>
          </div>
        </SortableContext>
      </DndContext>

      {lightboxIndex !== null && (
        <PhotoLightbox
          photos={attachedPhotos}
          index={lightboxIndex}
          onClose={() => setLightboxIndex(null)}
          onNavigate={setLightboxIndex}
        />
      )}
    </div>
  );
}
```

(new: `PhotoLightbox` import, `lightboxIndex` state, `attachedPhotos` derived list, `ThumbnailProps.onOpen` + the button wrapping the `<img>`, `index` passed through `attachedKeys.map`, and the conditional `<PhotoLightbox>` render at the bottom. Drag/delete/upload logic from Task 3 is unchanged)

- [ ] **Step 3: Typecheck + lint**

Run (from `fe/`): `bun run build && bun run lint`
Expected: no errors.

- [ ] **Step 4: Manual check**

Open an item with 2+ photos. Click a thumbnail (not the grip or "×") — confirm a full-screen dark overlay opens showing that photo large, with prev/next arrows and a close button. Click the right arrow, confirm it advances (wraps around from the last photo to the first). Press `Escape`, confirm it closes. Reopen and click the dark backdrop (not the image), confirm it closes. Reopen and click the image itself, confirm it does *not* close (only backdrop/×/Escape close it). Confirm dragging a thumbnail by its grip handle still works and doesn't accidentally open the lightbox.

- [ ] **Step 5: Commit**

```bash
git add fe/src/features/item/ui/photo-lightbox.tsx fe/src/features/item/ui/item-photos-field.tsx
git commit -m "feat(fe): photo lightbox"
```

---

### Task 5: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full build + lint**

Run: `cd fe && bun run build && bun run lint`
Expected: no errors.

- [ ] **Step 2: End-to-end manual walkthrough**

On a real item: upload two photos, confirm thumbnails render with real URLs after save; drag to reorder and confirm the new order persists after a reload; delete one and confirm it's gone from both the grid and (after save) the reloaded page; open the lightbox and click through prev/next and close it every way (×, backdrop, Escape); attempt an unsupported file type and confirm a toast error with no thumbnail added; confirm "Сохранить" is disabled for the duration of an upload and re-enabled once it completes.

- [ ] **Step 3: Report completion**

Summarize what was built. Note the known limitation from the spec (photos uploaded but not saved before navigating away become orphaned S3 objects — accepted trade-off, not a bug) and that Custom Fields remains out of scope (sub-project #3, still future, per `docs/superpowers/specs/2026-07-19-item-detail-page-design.md`).
