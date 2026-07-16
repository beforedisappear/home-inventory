# Container Edit (Rename) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user rename an existing container from its own header.

**Architecture:** Frontend-only (backend `PATCH /api/v1/containers/:id` already
accepts `{ name? }`, no changes needed there). New self-contained feature
slice `features/container-edit` with a single icon-button trigger that owns
its own overlay state and renders an `AdaptiveModal` with a one-field form —
no event emitter, no shared dialog (unlike `container-delete`), because
there is exactly one place this is triggered from.

**Tech Stack:** React, TanStack Query (mutation + cache invalidation),
TanStack Form + zod, HeroUI (`AdaptiveModal`), openapi-typescript generated
client (`apiClient`).

## Global Constraints

- Rename touches `name` only — `kind` and root `ruleId` are not editable
  here (spec: [2026-07-17-container-edit-design.md](../specs/2026-07-17-container-edit-design.md)).
- Name validation: `min(1)` / `max(128)` chars, matching backend
  `UpdateContainerDto` and the existing `create-container` schema.
- Trigger only in the container's own header (self-rename). No per-row
  rename in `ContainerList` in this plan.
- This project has no fe unit-test runner wired up — verification is
  `bun run build` (typecheck), `bun run lint`, and one manual browser
  walkthrough per task, matching every prior fe feature plan in this repo.
- Do not commit — the user commits manually. Every "Commit" step below is
  informational (what a human would run), not something the executor runs
  automatically before the user says so.

---

### Task 1: Data layer — update mutation

**Files:**
- Create: `fe/src/services/container/api/update.ts`
- Modify: `fe/src/services/container/api/container.queries.ts`

**Interfaces:**
- Consumes: `apiClient.PATCH` (from `@/shared/api/api-client`),
  `components['schemas']['UpdateContainerDto']` /
  `components['schemas']['ContainerResponseDto']` (from
  `@/kernel/api/schema`), `buildContainerByIdKey`,
  `buildContainerChildrenKey` (from `@/kernel/container/keys`), existing
  `mutationOptions` import pattern already used in
  `container.queries.ts`.
- Produces: `updateContainerRequest(id: string, dto: UpdateContainerDto):
  Promise<ContainerResponseDto>`, and `containerQueries.update()` — a
  `mutationOptions` whose `mutationFn` takes `{ id: string; parentId: string
  | null; name: string }` and returns `ContainerResponseDto`. Task 2's form
  hook calls `mutateAsync` with exactly that shape.

- [ ] **Step 1: Write the request function**

```ts
// fe/src/services/container/api/update.ts
import type { components } from '@/kernel/api/schema';
import { apiClient } from '@/shared/api/api-client';

type UpdateContainerDto = components['schemas']['UpdateContainerDto'];
type ContainerResponseDto = components['schemas']['ContainerResponseDto'];

export async function updateContainerRequest(
  id: string,
  dto: UpdateContainerDto,
): Promise<ContainerResponseDto> {
  const { data, error } = await apiClient.PATCH('/api/v1/containers/{id}', {
    params: { path: { id } },
    body: dto,
  });

  if (error) throw error;

  return data!;
}
```

- [ ] **Step 2: Add the mutation to `containerQueries`**

Open `fe/src/services/container/api/container.queries.ts`. Add the import
and the `update` key, alongside the existing `create`/`delete` keys:

```ts
import { updateContainerRequest } from './update';
```

```ts
  update: () =>
    mutationOptions({
      mutationFn: (vars: { id: string; parentId: string | null; name: string }) =>
        updateContainerRequest(vars.id, { name: vars.name }),
      onSuccess: (_data, vars) => {
        queryClient.invalidateQueries({
          queryKey: buildContainerByIdKey(vars.id),
        });
        queryClient.invalidateQueries({
          queryKey: buildContainerChildrenKey(vars.parentId),
        });
      },
    }),
```

Place it as a new property in the `containerQueries` object (order doesn't
matter — put it after `delete`).

- [ ] **Step 3: Typecheck**

Run: `cd fe && bun run build`
Expected: no TypeScript errors. This project has no unit tests for the fe
data layer — `tsc -b` catching a wrong `ContainerResponseDto`/DTO shape is
the verification here.

- [ ] **Step 4: Commit**

```bash
git add fe/src/services/container/api/update.ts fe/src/services/container/api/container.queries.ts
git commit -m "feat(fe): add container update mutation"
```

---

### Task 2: `features/container-edit` slice

**Files:**
- Create: `fe/src/features/container-edit/model/schemas.ts`
- Create: `fe/src/features/container-edit/model/use-container-edit-form.ts`
- Create: `fe/src/features/container-edit/ui/container-edit-form.tsx`
- Create: `fe/src/features/container-edit/ui/container-edit-modal.tsx`
- Create: `fe/src/features/container-edit/ui/container-edit-trigger.tsx`
- Create: `fe/src/features/container-edit/index.ts`

**Interfaces:**
- Consumes: `containerQueries.update()` from Task 1 (mutation vars shape
  `{ id, parentId, name }`), `AdaptiveModal` / `AdaptiveModal.Body` /
  `AdaptiveModal.Footer` / `Button` / `FormTextField` / `Spinner` / `toast`
  / `useOverlayState` / `UseOverlayStateReturn` (all from `@/shared/ui`).
- Produces: `ContainerEditTrigger` — the only public export, props
  `{ containerId: string; parentId: string | null; name: string }`. Task 3
  renders this directly inside `ContainerHeader`'s existing `actions`
  render-prop.

- [ ] **Step 1: Name validation schema**

```ts
// fe/src/features/container-edit/model/schemas.ts
import { z } from 'zod';

export const containerEditSchema = z.object({
  name: z.string().min(1, 'Поле обязательно').max(128, 'Слишком длинное имя'),
});
```

- [ ] **Step 2: Form hook**

```ts
// fe/src/features/container-edit/model/use-container-edit-form.ts
import { useForm } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';

import { containerQueries } from '@/services/container';

import { toast } from '@/shared/ui';

import { containerEditSchema } from './schemas';

interface UseContainerEditFormProps {
  containerId: string;
  parentId: string | null;
  name: string;
  onSuccess: () => void;
}

export function useContainerEditForm(props: UseContainerEditFormProps) {
  const { containerId, parentId, name, onSuccess } = props;

  const { mutateAsync: updateContainer } = useMutation(
    containerQueries.update(),
  );

  const form = useForm({
    defaultValues: { name },
    validators: { onSubmit: containerEditSchema },
    onSubmit: async ({ value }) => {
      try {
        await updateContainer({
          id: containerId,
          parentId,
          name: value.name,
        });
        toast.success('Контейнер переименован');
        onSuccess();
      } catch {
        toast.danger('Не удалось переименовать контейнер');
      }
    },
  });

  return { form };
}
```

- [ ] **Step 3: Form UI**

```tsx
// fe/src/features/container-edit/ui/container-edit-form.tsx
import { AdaptiveModal, Button, FormTextField, Spinner } from '@/shared/ui';

import { useContainerEditForm } from '../model/use-container-edit-form';

interface Props {
  containerId: string;
  parentId: string | null;
  name: string;
  onSuccess: () => void;
}

export function ContainerEditForm(props: Props) {
  const { form } = useContainerEditForm(props);

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
      </AdaptiveModal.Body>

      <AdaptiveModal.Footer className='mt-auto'>
        <form.Subscribe
          selector={s => ({
            canSubmit: s.canSubmit,
            isSubmitting: s.isSubmitting,
          })}
        >
          {({ canSubmit, isSubmitting }) => (
            <Button type='submit' isDisabled={!canSubmit || isSubmitting}>
              {isSubmitting ? <Spinner /> : 'Сохранить'}
            </Button>
          )}
        </form.Subscribe>
      </AdaptiveModal.Footer>
    </form>
  );
}
```

No separate "Отмена" button — same shape as
`features/user-profile/ui/user-email-change-form.tsx`, which relies on the
modal header's built-in close trigger for cancel.

- [ ] **Step 4: Modal wrapper**

```tsx
// fe/src/features/container-edit/ui/container-edit-modal.tsx
import type { UseOverlayStateReturn } from '@/shared/ui';
import { AdaptiveModal } from '@/shared/ui';

interface Props {
  children: React.ReactNode;
  state: UseOverlayStateReturn;
}

export function ContainerEditModal(props: Props) {
  const { children, state } = props;

  return (
    <AdaptiveModal state={state} heading='Переименовать контейнер'>
      {children}
    </AdaptiveModal>
  );
}
```

- [ ] **Step 5: Trigger**

```tsx
// fe/src/features/container-edit/ui/container-edit-trigger.tsx
import { Pencil } from 'lucide-react';

import { Button, useOverlayState } from '@/shared/ui';

import { ContainerEditForm } from './container-edit-form';
import { ContainerEditModal } from './container-edit-modal';

interface Props {
  containerId: string;
  parentId: string | null;
  name: string;
}

export function ContainerEditTrigger(props: Props) {
  const { containerId, parentId, name } = props;
  const state = useOverlayState();

  return (
    <>
      <Button
        type='button'
        isIconOnly
        variant='ghost'
        size='sm'
        aria-label='Переименовать контейнер'
        onPress={state.open}
      >
        <Pencil size={16} />
      </Button>

      <ContainerEditModal state={state}>
        <ContainerEditForm
          containerId={containerId}
          parentId={parentId}
          name={name}
          onSuccess={state.close}
        />
      </ContainerEditModal>
    </>
  );
}
```

- [ ] **Step 6: Public export**

```ts
// fe/src/features/container-edit/index.ts
export { ContainerEditTrigger } from './ui/container-edit-trigger';
```

- [ ] **Step 7: Typecheck + lint**

Run: `cd fe && bun run build && bun run lint`
Expected: both clean. `ContainerEditTrigger` isn't imported anywhere yet, so
this only catches internal type/lint errors within the new slice — Task 3
wires it up and is where you'll actually see it render.

- [ ] **Step 8: Commit**

```bash
git add fe/src/features/container-edit
git commit -m "feat(fe): container rename UI (features/container-edit)"
```

---

### Task 3: Wire into `ContainerByIdPage` + final verification

**Files:**
- Modify: `fe/src/pages/container-by-id/ui/container-by-id-page.tsx`

**Interfaces:**
- Consumes: `ContainerEditTrigger` from Task 2
  (`@/features/container-edit`), props `{ containerId, parentId, name }`.

- [ ] **Step 1: Add the trigger to the header's `actions` render-prop**

In `fe/src/pages/container-by-id/ui/container-by-id-page.tsx`, add the
import:

```ts
import { ContainerEditTrigger } from '@/features/container-edit';
```

Then, inside the existing `actions={container => (...)}` callback passed to
`ContainerHeader`, add `ContainerEditTrigger` before `CreateContainer`:

```tsx
          actions={container => {
            const handleNavigate = () =>
              void navigate(
                container.parentId
                  ? {
                      to: ROUTES.CONTAINER_BY_ID,
                      params: { id: container.parentId },
                    }
                  : { to: ROUTES.HOME },
              );

            return (
              <>
                <ContainerEditTrigger
                  containerId={container.id}
                  parentId={container.parentId}
                  name={container.name}
                />
                <CreateContainer parentId={container.id} />
                <ContainerDeleteTrigger
                  containerId={container.id}
                  parentId={container.parentId}
                  containerName={container.name}
                  onDeleted={handleNavigate}
                />
              </>
            );
          }}
```

Only the added `<ContainerEditTrigger ... />` block and the new import line
are new — everything else in the file is unchanged.

- [ ] **Step 2: Typecheck + lint**

Run: `cd fe && bun run build && bun run lint`
Expected: both clean.

- [ ] **Step 3: Manual walkthrough**

Start the dev server, log in, navigate into any non-root container
(one with a parent — a container you created inside another one):

1. Confirm a pencil icon now appears in the header next to the create/
   delete icon buttons.
2. Click it — a modal (desktop) or bottom drawer (mobile width) opens,
   titled "Переименовать контейнер", with the current name pre-filled.
3. Change the name, submit. Confirm: the modal closes, a "Контейнер
   переименован" toast appears, and the header now shows the new name.
4. Navigate back to the parent container (or Home, if the parent is root).
   Confirm the renamed container's row in the list shows the new name too
   (this is the `buildContainerChildrenKey` invalidation from Task 1
   working).
5. Try submitting an empty name — confirm the Save button is disabled /
   validation blocks it (zod `min(1)`).

- [ ] **Step 4: Commit**

```bash
git add fe/src/pages/container-by-id/ui/container-by-id-page.tsx
git commit -m "feat(fe): wire container rename trigger into container header"
```
