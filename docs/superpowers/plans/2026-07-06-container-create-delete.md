# Container Create/Delete Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add container creation (root from Home, child from any container view, with a rule-aware kind picker) and deletion (self-delete from the header, per-row delete from the children list) to the existing `features/container` and `features/container-list` slices.

**Architecture:** `services/container` gains `create`/`delete` mutations; a new `services/container-rule` slice adds a single `byId` query for fetching a parent's nesting rule. A page-agnostic FAB (`CreateContainerTrigger`) emits an `open` event (via the already-committed `shared/lib/event-emitter`) carrying `parentId`; a single `CreateContainerModal`, mounted once in `ProtectedLayout`, listens and opens itself — no prop drilling, no page-spanning store. The kind `Select` inside the create form is populated by `getAllowedKinds(parentKind, rule)`, a pure function mirroring the backend's `assertPlacementAllowed` filtering (UX only — backend still validates). Delete has no shared component: `ContainerHeader` (self-delete, navigates away on success) and a new `ContainerListItem` (row-delete, extracted from `ContainerList` so each row can hold its own dialog/mutation state) each wire up their own `AlertDialog` directly, since post-success behavior differs.

**Tech Stack:** React 19, TanStack Router/Query/Form, Zod, Tailwind v4, HeroUI (`@heroui/react`), lucide-react, Bun.

## Global Constraints

- No test framework in this repo. Per-task gate is a typecheck: `cd /Users/beforedisappear/dev/home-inventory/fe && npx tsc -b --noEmit`. Final gate: `bun run lint && bun run build`.
- Style: single quotes, semicolons, no unnecessary comments (only WHY-comments, matching surrounding files).
- FSD layer order `app → pages → features → services → kernel → shared` — no upward imports. Cross-slice consumers only import through a slice's `index.ts` barrel, never a deep internal path.
- Work directly on `main`. No branches/worktrees.
- Run `bun`/`tsc` from `fe/` with an absolute `cd` prefix (cwd resets between shell calls). Run `git` from repo root `/Users/beforedisappear/dev/home-inventory`.
- Commit messages: no `Co-Authored-By` / AI attribution.
- **Never run `git commit` without the user's explicit go-ahead for that specific commit** — this overrides the per-task "Commit" steps below. Confirm with the user before executing any Commit step.
- `shared/lib/event-emitter` (generic `EventEmitter` class + `useEvent` hook) already exists and is committed (`d196560`) — do not recreate it, just import from `@/shared/lib/event-emitter`.
- No backend/API changes — `POST /api/v1/containers`, `DELETE /api/v1/containers/{id}`, `GET /api/v1/container-rules/{id}` already exist and are already in the generated `fe/src/kernel/api/schema.ts`.
- No `ContainerRule` management UI, no move/edit UI, no parsing of backend error bodies (generic toast per the approved spec `docs/superpowers/specs/2026-07-06-container-create-delete-design.md`) — root containers are created without `ruleId`.
- **Trigger nesting pitfall (already bit this codebase once):** `Modal.Trigger`, `AlertDialog.Trigger`, and `Dropdown.Trigger` all render their own `<button role="button">`-equivalent wrapper (via react-aria-components `Pressable`). Never put a HeroUI `Button` (or a raw `<button>`) *inside* one of these Trigger components — it produces nested interactive elements (invalid HTML, hydration warning, the exact bug fixed in `header-mobile-content.tsx` in commit `2b9c8b6`). Apply `className`/`aria-label` directly to the Trigger itself instead.
- **Create and delete are separate top-level features** (`features/container-create`, `features/container-delete`), not code inside `features/container`/`features/container-list` — this was corrected mid-execution (see Task 2/4 revision notes) per the user's explicit direction. `fe/CLAUDE.md`'s FSD rule forbids same-layer (feature-to-feature) imports, so `container-delete`'s `ContainerDeleteButton` cannot be imported by `features/container` or `features/container-list` directly — composition happens at the **pages** layer via small render-prop slots (`ContainerHeader`'s `actions`, `ContainerList`'s `renderItemActions`).

---

### Task 1: Data layer — create/delete mutations + `services/container-rule`

**Files:**
- Modify: `fe/src/kernel/container/keys.ts`
- Create: `fe/src/services/container/api/create.ts`
- Create: `fe/src/services/container/api/delete.ts`
- Modify: `fe/src/services/container/api/container.queries.ts`
- Create: `fe/src/services/container-rule/api/find-by-id.ts`
- Create: `fe/src/services/container-rule/api/container-rule.queries.ts`
- Create: `fe/src/services/container-rule/index.ts`

**Interfaces:**
- Consumes: `apiClient` from `@/shared/api/api-client`; `queryClient` from `@/shared/api/query-client`; `components` types from `@/kernel/api/schema` (all existing).
- Produces: `containerQueries.create()` and `containerQueries.delete()` (both `mutationOptions`, exported from `@/services/container`, unchanged export name); `containerRuleQueries.byId(id: string)` (`queryOptions`, exported from `@/services/container-rule`); `buildContainerRuleByIdKey(id: string)` exported from `@/kernel/container/keys`.

- [ ] **Step 1: Add the rule query key**

Replace `fe/src/kernel/container/keys.ts`:

```ts
export const buildContainerChildrenKey = (parentId: string | null) =>
  ['container', 'children', parentId] as const;

export const buildContainerByIdKey = (id: string) => ['container', id] as const;

export const buildContainerRuleByIdKey = (id: string) =>
  ['container-rule', id] as const;
```

- [ ] **Step 2: `create` request**

Create `fe/src/services/container/api/create.ts`:

```ts
import type { components } from '@/kernel/api/schema';
import { apiClient } from '@/shared/api/api-client';

type CreateContainerDto = components['schemas']['CreateContainerDto'];
type ContainerResponseDto = components['schemas']['ContainerResponseDto'];

export async function createContainerRequest(
  dto: CreateContainerDto,
): Promise<ContainerResponseDto> {
  const { data, error } = await apiClient.POST('/api/v1/containers', {
    body: dto,
  });

  if (error) throw error;

  return data!;
}
```

- [ ] **Step 3: `delete` request**

Create `fe/src/services/container/api/delete.ts`:

```ts
import { apiClient } from '@/shared/api/api-client';

export async function deleteContainerRequest(id: string): Promise<void> {
  const { error } = await apiClient.DELETE('/api/v1/containers/{id}', {
    params: { path: { id } },
  });

  if (error) throw error;
}
```

- [ ] **Step 4: Add mutations to the query factory**

Replace `fe/src/services/container/api/container.queries.ts`:

```ts
import { mutationOptions, queryOptions } from '@tanstack/react-query';

import {
  buildContainerByIdKey,
  buildContainerChildrenKey,
} from '@/kernel/container/keys';

import { queryClient } from '@/shared/api/query-client';

import { createContainerRequest } from './create';
import { deleteContainerRequest } from './delete';
import { findContainerByIdRequest } from './find-by-id';
import { findChildrenRequest } from './find-children';

export const containerQueries = {
  children: (parentId: string | null) =>
    queryOptions({
      queryKey: buildContainerChildrenKey(parentId),
      queryFn: () => findChildrenRequest(parentId),
    }),

  byId: (id: string) =>
    queryOptions({
      queryKey: buildContainerByIdKey(id),
      queryFn: () => findContainerByIdRequest(id),
    }),

  create: () =>
    mutationOptions({
      mutationFn: createContainerRequest,
      onSuccess: data => {
        queryClient.invalidateQueries({
          queryKey: buildContainerChildrenKey(data.parentId),
        });
      },
    }),

  delete: () =>
    mutationOptions({
      mutationFn: (vars: { id: string; parentId: string | null }) =>
        deleteContainerRequest(vars.id),
      onSuccess: (_data, vars) => {
        queryClient.invalidateQueries({
          queryKey: buildContainerChildrenKey(vars.parentId),
        });
        queryClient.removeQueries({ queryKey: buildContainerByIdKey(vars.id) });
      },
    }),
};
```

- [ ] **Step 5: `container-rule` find-by-id request**

Create `fe/src/services/container-rule/api/find-by-id.ts`:

```ts
import type { components } from '@/kernel/api/schema';
import { apiClient } from '@/shared/api/api-client';

type ContainerRuleResponseDto =
  components['schemas']['ContainerRuleResponseDto'];

export async function findContainerRuleByIdRequest(
  id: string,
): Promise<ContainerRuleResponseDto> {
  const { data, error } = await apiClient.GET('/api/v1/container-rules/{id}', {
    params: { path: { id } },
  });

  if (error) throw error;

  return data!;
}
```

- [ ] **Step 6: `container-rule` query factory + barrel**

Create `fe/src/services/container-rule/api/container-rule.queries.ts`:

```ts
import { queryOptions } from '@tanstack/react-query';

import { buildContainerRuleByIdKey } from '@/kernel/container/keys';

import { findContainerRuleByIdRequest } from './find-by-id';

export const containerRuleQueries = {
  byId: (id: string) =>
    queryOptions({
      queryKey: buildContainerRuleByIdKey(id),
      queryFn: () => findContainerRuleByIdRequest(id),
    }),
};
```

Create `fe/src/services/container-rule/index.ts`:

```ts
export { containerRuleQueries } from './api/container-rule.queries';
```

- [ ] **Step 7: Typecheck**

Run: `cd /Users/beforedisappear/dev/home-inventory/fe && npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 8: Commit**

Requires explicit user go-ahead first (see Global Constraints).

```bash
cd /Users/beforedisappear/dev/home-inventory && git add fe/src/kernel/container/keys.ts fe/src/services/container fe/src/services/container-rule && git commit -m "feat(fe): add container create/delete mutations + container-rule query"
```

---

### Task 2: Create flow — model layer

> **Revised after Tasks 1–3 were already implemented once:** the user clarified create and delete must each live in their own top-level feature (`features/container-create`, `features/container-delete`), not inside the existing `features/container`/`features/container-list` slices. Tasks 2–3 below were already implemented against the old paths and have been **moved** (not re-implemented) to `features/container-create/*` — this section reflects the actual, final file paths and code (including two implementer-discovered type-correctness deviations, noted inline). Tasks 4–5 are rewritten from scratch below to introduce `features/container-delete` and compose it at the **pages** layer, since this repo's own FSD convention (`fe/CLAUDE.md`) forbids feature-to-feature imports — delete's UI can't be imported directly by `features/container`/`features/container-list`, so `ContainerHeader` and `ContainerList` gain small slot props (`actions`, `renderItemActions`) that pages fill in.

**Files:**
- Create: `fe/src/features/container-create/model/schemas.ts`
- Create: `fe/src/features/container-create/model/get-allowed-kinds.ts`
- Create: `fe/src/features/container-create/model/create-container-events.ts`
- Create: `fe/src/features/container-create/model/use-create-container-form.ts`

**Interfaces:**
- Consumes: `containerQueries` from `@/services/container` (create/byId, Task 1); `containerRuleQueries` from `@/services/container-rule` (Task 1); `EventEmitter` from `@/shared/lib/event-emitter` (already exists); `toast` from `@/shared/ui` (existing).
- Produces: `createContainerSchema` (zod); `getAllowedKinds(parentKind, rule): NonNullable<ContainerKind>[]`; `createContainerEvents: EventEmitter<{ open: { parentId: string | null } }>`; `useCreateContainerForm({ parentId, onSuccess }) => { form, allowedKinds }` — all consumed by Task 3's UI components.

- [x] **Step 1: Validation schema** (done — implemented + moved)

Create `fe/src/features/container-create/model/schemas.ts`:

```ts
import { z } from 'zod';

export const createContainerSchema = z.object({
  name: z.string().min(1, 'Поле обязательно').max(128, 'Слишком длинное имя'),
  kind: z.string(),
});
```

Deviation from the original draft: `kind` is `z.string()`, not `.optional()`. `use-create-container-form.ts`'s `defaultValues: { kind: '' }` types the form's `kind` field as always-`string`; TanStack Form's Standard-Schema validator requires the schema's static input type to match invariantly. `z.string()` still accepts `''` at runtime, so root-container behavior (kind stays empty) is unchanged — this only tightens the static type.

- [x] **Step 2: Allowed-kinds pure function** (done — implemented + moved, verbatim)

Create `fe/src/features/container-create/model/get-allowed-kinds.ts`:

```ts
import type { components } from '@/kernel/api/schema';

type ContainerKind = components['schemas']['ContainerResponseDto']['kind'];
type ContainerRuleResponseDto =
  components['schemas']['ContainerRuleResponseDto'];

// та же фильтрация, что backend делает в assertPlacementAllowed — только для UX,
// backend всё равно валидирует на create
export function getAllowedKinds(
  parentKind: ContainerKind,
  rule: ContainerRuleResponseDto | null,
): NonNullable<ContainerKind>[] {
  if (!rule) return ['room', 'cabinet', 'drawer', 'box', 'bag'];

  return rule.kindRules
    .filter(kindRule =>
      parentKind
        ? kindRule.allowedParents.includes(parentKind)
        : kindRule.canBeInsideRoot,
    )
    .map(kindRule => kindRule.kind);
}
```

- [x] **Step 3: Typecheck the pure function** (done)

Run: `cd /Users/beforedisappear/dev/home-inventory/fe && npx tsc -b --noEmit`
Expected: no errors.

- [x] **Step 4: Create-modal event emitter instance** (done — implemented + moved)

Create `fe/src/features/container-create/model/create-container-events.ts`:

```ts
import { EventEmitter } from '@/shared/lib/event-emitter';

type CreateContainerEvents = {
  open: { parentId: string | null };
};

export const createContainerEvents = new EventEmitter<CreateContainerEvents>();
```

Deviation from the original draft: `type` alias, not `interface`. `EventEmitter<Events extends Record<string, unknown>>` requires its type argument to satisfy an index-signature constraint; a plain `interface` never gets an implicit index signature in TS (by design — interfaces support declaration merging), while an equivalent `type` alias does. Verified directly against `fe/src/shared/lib/event-emitter/event-emitter.ts`. Public shape (`EventEmitter<{ open: { parentId: string | null } }>`) is unchanged.

- [x] **Step 5: Form hook** (done — implemented + moved, verbatim)

Create `fe/src/features/container-create/model/use-create-container-form.ts`:

```ts
import { useForm } from '@tanstack/react-form';
import { useMutation, useQuery } from '@tanstack/react-query';

import { containerQueries } from '@/services/container';
import { containerRuleQueries } from '@/services/container-rule';

import type { components } from '@/kernel/api/schema';

import { toast } from '@/shared/ui';

import { getAllowedKinds } from './get-allowed-kinds';
import { createContainerSchema } from './schemas';

type CreateContainerDto = components['schemas']['CreateContainerDto'];

interface UseCreateContainerFormProps {
  parentId: string | null;
  onSuccess: () => void;
}

// root (parentId === null) — только имя. child — имя + kind, список kind сужен
// по правилу родителя (см. get-allowed-kinds.ts)
export function useCreateContainerForm(props: UseCreateContainerFormProps) {
  const { parentId, onSuccess } = props;

  const { data: parent } = useQuery({
    ...containerQueries.byId(parentId ?? ''),
    enabled: !!parentId,
  });

  const { data: rule } = useQuery({
    ...containerRuleQueries.byId(parent?.ruleId ?? ''),
    enabled: !!parent?.ruleId,
  });

  const allowedKinds = parentId
    ? getAllowedKinds(parent?.kind ?? null, rule ?? null)
    : [];

  const { mutateAsync: createContainer } = useMutation(
    containerQueries.create(),
  );

  const form = useForm({
    defaultValues: { name: '', kind: '' },
    validators: { onSubmit: createContainerSchema },
    onSubmit: async ({ value }) => {
      try {
        await createContainer({
          name: value.name,
          parentId: parentId ?? undefined,
          kind: parentId
            ? (value.kind as CreateContainerDto['kind'])
            : undefined,
        });
        toast.success('Контейнер создан');
        onSuccess();
      } catch {
        toast.danger('Не удалось создать контейнер');
      }
    },
  });

  return { form, allowedKinds };
}
```

- [x] **Step 6: Typecheck** (done)

Run: `cd /Users/beforedisappear/dev/home-inventory/fe && npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 7: Commit**

Requires explicit user go-ahead first (see Global Constraints).

```bash
cd /Users/beforedisappear/dev/home-inventory && git add fe/src/features/container-create/model && git commit -m "feat(fe): create-container form model with rule-aware kind filtering"
```

---

### Task 3: Create flow — UI (form, modal, FAB triggers)

First visually-verifiable checkpoint for creation.

**Files (final, after the container-create relocation):**
- Modify: `fe/src/shared/ui/index.ts`
- Create: `fe/src/features/container-create/ui/create-container-form.tsx`
- Create: `fe/src/features/container-create/ui/create-container-modal.tsx`
- Create: `fe/src/features/container-create/ui/create-container-trigger.tsx`
- Create: `fe/src/features/container-create/index.ts`
- Modify: `fe/src/app/layouts/protected-layout.tsx`
- Modify: `fe/src/pages/home/ui/home-page.tsx`
- Modify: `fe/src/pages/container-by-id/ui/container-by-id-page.tsx`

**Interfaces:**
- Consumes: `useCreateContainerForm`, `createContainerEvents` (Task 2); `useEvent` from `@/shared/lib/event-emitter`; `getContainerKindLabel` from `@/kernel/container/kind-label` (existing).
- Produces: `CreateContainerModal` (no props, mounted once) and `CreateContainerTrigger({ parentId: string | null })`, both exported from `@/features/container-create` (its own barrel — `features/container`'s barrel only exports `ContainerHeader`).

- [x] **Step 1: Add `AlertDialog`, `ListBox`, `Select` to the shared UI barrel** (done)

Replace `fe/src/shared/ui/index.ts`:

```ts
// единая точка ui-kit: фичи берут компоненты отсюда, не из @heroui/react напрямую
export {
  AlertDialog,
  Button,
  Chip,
  Dropdown,
  ErrorMessage,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  Skeleton,
  Spinner,
  TextField,
  Toast,
  Tooltip,
  Typography,
  toast,
  useOverlayState,
  type UseOverlayStateReturn,
} from '@heroui/react';

export { Brand } from './brand';
export { EmptyState } from './empty-state';
export { ErrorState } from './error-state';
export { FormOtpField } from './form-otp-field';
export { FormTextField } from './form-text-field';
export { ThemeToggle } from './theme-toggle';
```

- [x] **Step 2: Create-container form** (done — implemented + moved, verbatim)

Create `fe/src/features/container-create/ui/create-container-form.tsx`:

```tsx
import { getContainerKindLabel } from '@/kernel/container/kind-label';

import {
  Button,
  FormTextField,
  ListBox,
  Select,
  Spinner,
  Typography,
} from '@/shared/ui';

import { useCreateContainerForm } from '../model/use-create-container-form';

interface Props {
  parentId: string | null;
  onSuccess: () => void;
}

export function CreateContainerForm({ parentId, onSuccess }: Props) {
  const { form, allowedKinds } = useCreateContainerForm({
    parentId,
    onSuccess,
  });

  const isDeadEnd = parentId !== null && allowedKinds.length === 0;

  return (
    <form
      className='flex flex-col gap-3 p-4'
      onSubmit={e => {
        e.preventDefault();
        e.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <form.Field name='name'>
        {field => <FormTextField field={field} label='Название' />}
      </form.Field>

      {parentId !== null && !isDeadEnd && (
        <form.Field name='kind'>
          {field => (
            <Select.Root
              selectedKey={field.state.value || null}
              onSelectionChange={key => field.handleChange(String(key))}
              placeholder='Выберите тип'
              className='flex flex-col gap-1'
            >
              <Select.Trigger className='flex items-center justify-between gap-2 rounded-lg border border-field-border bg-field-background px-3 py-2'>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover>
                <ListBox>
                  {allowedKinds.map(kind => (
                    <ListBox.Item key={kind} id={kind}>
                      {getContainerKindLabel(kind)}
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select.Root>
          )}
        </form.Field>
      )}

      {isDeadEnd && (
        <Typography type='body-sm' color='muted'>
          Внутрь этого контейнера ничего нельзя добавить.
        </Typography>
      )}

      <form.Subscribe
        selector={state => ({
          canSubmit: state.canSubmit,
          isSubmitting: state.isSubmitting,
          kind: state.values.kind,
        })}
      >
        {({ canSubmit, isSubmitting, kind }) => (
          <Button
            type='submit'
            className='mt-2'
            isDisabled={
              !canSubmit ||
              isSubmitting ||
              isDeadEnd ||
              (parentId !== null && !kind)
            }
          >
            {isSubmitting ? <Spinner /> : 'Создать'}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
```

- [x] **Step 3: Globally-mounted create modal** (done — implemented + moved, verbatim)

Create `fe/src/features/container-create/ui/create-container-modal.tsx`:

```tsx
import { useState } from 'react';

import { useEvent } from '@/shared/lib/event-emitter';

import { Modal, useOverlayState } from '@/shared/ui';

import { createContainerEvents } from '../model/create-container-events';
import { CreateContainerForm } from './create-container-form';

export function CreateContainerModal() {
  const [parentId, setParentId] = useState<string | null>(null);
  const state = useOverlayState();

  useEvent(createContainerEvents, 'open', payload => {
    setParentId(payload.parentId);
    state.open();
  });

  return (
    <Modal.Root state={state}>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>Новый контейнер</Modal.Heading>
              <Modal.CloseTrigger />
            </Modal.Header>

            <CreateContainerForm parentId={parentId} onSuccess={state.close} />
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal.Root>
  );
}
```

- [x] **Step 4: FAB trigger** (done — implemented + moved, verbatim)

Create `fe/src/features/container-create/ui/create-container-trigger.tsx`:

```tsx
import { Plus } from 'lucide-react';

import { Button } from '@/shared/ui';

import { createContainerEvents } from '../model/create-container-events';

interface Props {
  parentId: string | null;
}

export function CreateContainerTrigger({ parentId }: Props) {
  return (
    <Button
      type='button'
      isIconOnly
      aria-label='Добавить контейнер'
      className='fixed right-6 bottom-6 size-14 rounded-full shadow-lg'
      onPress={() => createContainerEvents.emit('open', { parentId })}
    >
      <Plus size={24} />
    </Button>
  );
}
```

- [x] **Step 5: Barrel exports** (done — final: `features/container-create` gets its own new barrel; `features/container`'s barrel is untouched, still just `ContainerHeader`)

Create `fe/src/features/container-create/index.ts`:

```ts
export { CreateContainerModal } from './ui/create-container-modal';
export { CreateContainerTrigger } from './ui/create-container-trigger';
```

`fe/src/features/container/index.ts` stays as it was before this task:

```ts
export { ContainerHeader } from './ui/container-header';
```

- [x] **Step 6: Mount the modal once in the protected layout** (done)

Replace `fe/src/app/layouts/protected-layout.tsx`:

```tsx
import { Outlet } from '@tanstack/react-router';

import { useUnauthenticatedRedirect } from '@/services/session';

import { CreateContainerModal } from '@/features/container-create';
import { Header } from '@/features/header';

// общий скелет всех защищённых страниц: хедер + контентная область под ним
export function ProtectedLayout() {
  useUnauthenticatedRedirect();

  return (
    <div className='flex min-h-svh flex-col'>
      <Header />

      <main className='flex flex-1 flex-col'>
        <Outlet />
      </main>

      <CreateContainerModal />
    </div>
  );
}
```

- [x] **Step 7: Wire the FAB into Home** (done)

Replace `fe/src/pages/home/ui/home-page.tsx`:

```tsx
import { CreateContainerTrigger } from '@/features/container-create';
import { ContainerList } from '@/features/container-list';

export function HomePage() {
  return (
    <div className='flex flex-1 flex-col items-center p-4'>
      <div className='flex w-full max-w-2xl flex-1 flex-col gap-6'>
        <ContainerList parentId={null} />
      </div>

      <CreateContainerTrigger parentId={null} />
    </div>
  );
}
```

- [x] **Step 8: Wire the FAB into `ContainerByIdPage`** (done — final import split shown; Task 4 below edits this file again to add the delete-button slot)

Replace `fe/src/pages/container-by-id/ui/container-by-id-page.tsx`:

```tsx
import { useParams } from '@tanstack/react-router';

import { CreateContainerTrigger } from '@/features/container-create';
import { ContainerHeader } from '@/features/container';
import { ContainerList } from '@/features/container-list';

export function ContainerByIdPage() {
  const { id } = useParams({ from: '/protected/containers/$id' });

  return (
    <div className='flex flex-1 flex-col items-center p-4'>
      <div className='flex w-full max-w-2xl flex-1 flex-col gap-6'>
        <ContainerHeader parentId={id} />
        <ContainerList parentId={id} />
      </div>

      <CreateContainerTrigger parentId={id} />
    </div>
  );
}
```

- [x] **Step 9: Typecheck** (done — clean)

Run: `cd /Users/beforedisappear/dev/home-inventory/fe && npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 10: Manual check (dev server + backend running)**

Run: `cd /Users/beforedisappear/dev/home-inventory/fe && bun run dev`

- Home shows a floating `+` button bottom-right. Click it → modal opens with only a name field (no kind — root).
- Create a root container (e.g. "Квартира") → modal closes, toast "Контейнер создан", new container appears in the Home list.
- Drill into it, click its `+` button → modal opens with name + kind select. Since this root has no `ruleId`, all 5 kinds should be selectable.
- Create a child with `kind: room` (e.g. "Кухня"). Drill into it, click `+` again — kind select should still show all 5 (this room has no `ruleId` either, since `ruleId` is only ever set when explicitly passed at root creation, which this plan's root form never does).
- Submit with an empty name → button stays disabled (client-side), or backend 400 → toast "Не удалось создать контейнер" (whichever fires first).

Stop the dev server when done.

- [ ] **Step 11: Commit**

Requires explicit user go-ahead first (see Global Constraints).

```bash
cd /Users/beforedisappear/dev/home-inventory && git add fe/src/shared/ui/index.ts fe/src/features/container-create fe/src/features/container/index.ts fe/src/app/layouts/protected-layout.tsx fe/src/pages/home/ui/home-page.tsx fe/src/pages/container-by-id/ui/container-by-id-page.tsx && git commit -m "feat(fe): create container UI — FAB trigger, global modal, rule-aware kind select"
```

---

### Task 4: `features/container-delete` + self-delete slot in `ContainerHeader`

> **Revised:** delete is its own top-level feature (`features/container-delete`), not code embedded in `features/container`. Per `fe/CLAUDE.md`'s FSD rule ("No same-layer cross-import ... Two features must not import each other"), `features/container` cannot import `features/container-delete` directly — the composition happens at the **pages** layer instead. `ContainerHeader` gains a small `actions` render-prop slot; the page supplies `ContainerDeleteButton` (from `container-delete`) into that slot and wires its own `onDeleted` (navigate away). This same `ContainerDeleteButton` is reused unmodified by Task 5's row-delete.

**Files:**
- Create: `fe/src/features/container-delete/ui/container-delete-button.tsx`
- Create: `fe/src/features/container-delete/index.ts`
- Modify: `fe/src/features/container/ui/container-header.tsx`
- Modify: `fe/src/pages/container-by-id/ui/container-by-id-page.tsx`

**Interfaces:**
- Consumes: `containerQueries.delete()` (Task 1); `AlertDialog`, `Button`, `toast`, `useOverlayState` from `@/shared/ui`.
- Produces: `ContainerDeleteButton({ containerId: string; parentId: string | null; containerName: string; onDeleted?: () => void })`, exported from `@/features/container-delete` — this exact signature is also consumed by Task 5. `ContainerHeader`'s props become `{ parentId: string; actions?: (container: ContainerResponseDto) => ReactNode }` (`ContainerResponseDto` from `@/kernel/api/schema`'s `components['schemas']`) — `actions` is called once the container has loaded and rendered next to the kind `Chip`.

- [ ] **Step 1: `ContainerDeleteButton` — the reusable delete button + confirm dialog + mutation**

Create `fe/src/features/container-delete/ui/container-delete-button.tsx`:

```tsx
import { useMutation } from '@tanstack/react-query';
import { Trash2 } from 'lucide-react';

import { containerQueries } from '@/services/container';

import { AlertDialog, Button, toast, useOverlayState } from '@/shared/ui';

interface Props {
  containerId: string;
  parentId: string | null;
  containerName: string;
  onDeleted?: () => void;
}

export function ContainerDeleteButton({
  containerId,
  parentId,
  containerName,
  onDeleted,
}: Props) {
  const deleteState = useOverlayState();

  const { mutateAsync: deleteContainer, isPending: isDeleting } = useMutation(
    containerQueries.delete(),
  );

  const handleDelete = async () => {
    try {
      await deleteContainer({ id: containerId, parentId });
      deleteState.close();
      onDeleted?.();
    } catch {
      toast.danger(
        'Контейнер не пуст — уберите вложенные контейнеры и вещи, чтобы удалить',
      );
    }
  };

  return (
    <AlertDialog.Root
      isOpen={deleteState.isOpen}
      onOpenChange={deleteState.setOpen}
    >
      <AlertDialog.Trigger
        aria-label='Удалить контейнер'
        className='flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-secondary hover:text-danger'
      >
        <Trash2 size={16} />
      </AlertDialog.Trigger>

      <AlertDialog.Backdrop>
        <AlertDialog.Container>
          <AlertDialog.Dialog>
            <AlertDialog.Icon />
            <AlertDialog.Header>
              <AlertDialog.Heading>
                Удалить «{containerName}»?
              </AlertDialog.Heading>
            </AlertDialog.Header>
            <AlertDialog.Body>Это действие нельзя отменить.</AlertDialog.Body>
            <AlertDialog.Footer>
              <Button type='button' variant='ghost' onPress={deleteState.close}>
                Отмена
              </Button>
              <Button
                type='button'
                variant='danger'
                isDisabled={isDeleting}
                onPress={handleDelete}
              >
                Удалить
              </Button>
            </AlertDialog.Footer>
          </AlertDialog.Dialog>
        </AlertDialog.Container>
      </AlertDialog.Backdrop>
    </AlertDialog.Root>
  );
}
```

- [ ] **Step 2: Barrel**

Create `fe/src/features/container-delete/index.ts`:

```ts
export { ContainerDeleteButton } from './ui/container-delete-button';
```

- [ ] **Step 3: Give `ContainerHeader` an `actions` slot**

Replace `fe/src/features/container/ui/container-header.tsx`:

```tsx
import type { ReactNode } from 'react';

import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ChevronLeft } from 'lucide-react';

import { containerQueries } from '@/services/container';

import type { components } from '@/kernel/api/schema';
import { getContainerKindLabel } from '@/kernel/container/kind-label';
import { ROUTES } from '@/kernel/routes';

import { Chip, ErrorState, Skeleton, Typography } from '@/shared/ui';

import { ContainerName } from './container-name';

type ContainerResponseDto = components['schemas']['ContainerResponseDto'];

interface Props {
  parentId: string;
  actions?: (container: ContainerResponseDto) => ReactNode;
}

export function ContainerHeader({ parentId, actions }: Props) {
  const {
    data: container,
    isPending,
    isError,
    refetch,
  } = useQuery(containerQueries.byId(parentId));

  const { data: parent } = useQuery({
    ...containerQueries.byId(container?.parentId ?? ''),
    enabled: !!container?.parentId,
  });

  if (isPending) {
    return (
      <div className='flex flex-col gap-2 border-b border-border pb-4'>
        <Skeleton className='h-6 w-24' />
        <Skeleton className='h-8 w-48' />
      </div>
    );
  }

  if (isError || !container) {
    return (
      <div className='flex flex-col gap-2 border-b border-border pb-4'>
        <ErrorState onRetry={() => refetch()}>
          Не удалось загрузить контейнер
        </ErrorState>
        <Link to={ROUTES.HOME} className='inline-flex w-fit items-center gap-1'>
          <ChevronLeft size={16} />
          <Typography type='body-sm' color='muted'>
            На главную
          </Typography>
        </Link>
      </div>
    );
  }

  const kindLabel = getContainerKindLabel(container.kind);

  return (
    <div className='flex flex-col gap-2 border-b border-border pb-4'>
      {container.parentId ? (
        <Link
          to={ROUTES.CONTAINER_BY_ID}
          params={{ id: container.parentId }}
          className='inline-flex w-fit items-center gap-1'
        >
          <ChevronLeft size={16} />
          <Typography type='body-sm' color='muted'>
            {parent?.name ?? 'Назад'}
          </Typography>
        </Link>
      ) : (
        <Link to={ROUTES.HOME} className='inline-flex w-fit items-center gap-1'>
          <ChevronLeft size={16} />
          <Typography type='body-sm' color='muted'>
            На главную
          </Typography>
        </Link>
      )}

      <div className='flex items-center justify-between gap-2'>
        <ContainerName name={container.name} />

        <div className='flex shrink-0 items-center gap-2'>
          {kindLabel && <Chip size='sm'>{kindLabel}</Chip>}
          {actions?.(container)}
        </div>
      </div>
    </div>
  );
}
```

- [ ] **Step 4: Wire the delete button + navigate-on-success into `ContainerByIdPage`**

Replace `fe/src/pages/container-by-id/ui/container-by-id-page.tsx`:

```tsx
import { useNavigate, useParams } from '@tanstack/react-router';

import { ContainerHeader } from '@/features/container';
import { CreateContainerTrigger } from '@/features/container-create';
import { ContainerDeleteButton } from '@/features/container-delete';
import { ContainerList } from '@/features/container-list';

import { ROUTES } from '@/kernel/routes';

export function ContainerByIdPage() {
  const { id } = useParams({ from: '/protected/containers/$id' });
  const navigate = useNavigate();

  return (
    <div className='flex flex-1 flex-col items-center p-4'>
      <div className='flex w-full max-w-2xl flex-1 flex-col gap-6'>
        <ContainerHeader
          parentId={id}
          actions={container => (
            <ContainerDeleteButton
              containerId={container.id}
              parentId={container.parentId}
              containerName={container.name}
              onDeleted={() =>
                void navigate(
                  container.parentId
                    ? {
                        to: ROUTES.CONTAINER_BY_ID,
                        params: { id: container.parentId },
                      }
                    : { to: ROUTES.HOME },
                )
              }
            />
          )}
        />
        <ContainerList parentId={id} />
      </div>

      <CreateContainerTrigger parentId={id} />
    </div>
  );
}
```

- [ ] **Step 5: Typecheck**

Run: `cd /Users/beforedisappear/dev/home-inventory/fe && npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 6: Commit**

Requires explicit user go-ahead first (see Global Constraints).

```bash
cd /Users/beforedisappear/dev/home-inventory && git add fe/src/features/container-delete fe/src/features/container/ui/container-header.tsx fe/src/pages/container-by-id/ui/container-by-id-page.tsx && git commit -m "feat(fe): container-delete feature + self-delete from header"
```

---

### Task 5: Delete — per-row delete in the children list

> **Revised:** reuses Task 4's `ContainerDeleteButton` from `features/container-delete` instead of a new component. This also removes the need for a separate `ContainerListItem` component: the original reason to extract one was "hooks can't be called inside a `.map()` callback" — but now the delete mutation/dialog state lives inside `ContainerDeleteButton`, a component instance rendered per row via a render-prop, not a hook called directly in `ContainerList`'s `.map()` body. `ContainerList` itself stays a single component and only gains a slot prop.

**Files:**
- Modify: `fe/src/features/container-list/ui/container-list.tsx`
- Modify: `fe/src/pages/home/ui/home-page.tsx`
- Modify: `fe/src/pages/container-by-id/ui/container-by-id-page.tsx`

**Interfaces:**
- Consumes: `ContainerDeleteButton` from `@/features/container-delete` (Task 4) — used only by the two pages, not by `features/container-list` itself (still no cross-feature import).
- Produces: `ContainerList`'s props become `{ parentId: string | null; renderItemActions?: (child: ContainerResponseDto) => ReactNode }`.

- [ ] **Step 1: Give `ContainerList` a `renderItemActions` slot**

Replace `fe/src/features/container-list/ui/container-list.tsx`:

```tsx
import type { ReactNode } from 'react';

import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ChevronRight, PackageOpen } from 'lucide-react';

import { containerQueries } from '@/services/container';

import type { components } from '@/kernel/api/schema';
import { getContainerKindIcon } from '@/kernel/container/kind-icon';
import { ROUTES } from '@/kernel/routes';

import { EmptyState, ErrorState, Spinner, Typography } from '@/shared/ui';

type ContainerResponseDto = components['schemas']['ContainerResponseDto'];

interface Props {
  parentId: string | null;
  renderItemActions?: (child: ContainerResponseDto) => ReactNode;
}

export function ContainerList({ parentId, renderItemActions }: Props) {
  const { data, isPending, isError, refetch } = useQuery(
    containerQueries.children(parentId),
  );

  if (isPending) {
    return (
      <div className='flex flex-1 flex-col items-center justify-center'>
        <Spinner />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState onRetry={() => refetch()}>
        Не удалось загрузить контейнеры
      </ErrorState>
    );
  }

  if (data.length === 0) {
    return <EmptyState icon={PackageOpen}>Здесь пока пусто</EmptyState>;
  }

  return (
    <ul className='flex flex-col gap-2'>
      {data.map(child => {
        const Icon = getContainerKindIcon(child.kind);

        return (
          <li key={child.id} className='flex items-center gap-2'>
            <Link
              to={ROUTES.CONTAINER_BY_ID}
              params={{ id: child.id }}
              className='flex min-w-0 flex-1 items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3 transition-colors hover:bg-surface-secondary'
            >
              <span className='flex min-w-0 items-center gap-3'>
                <Icon size={18} className='shrink-0 text-muted' />
                <Typography truncate>{child.name}</Typography>
              </span>
              <ChevronRight size={16} className='shrink-0 text-muted' />
            </Link>

            {renderItemActions?.(child)}
          </li>
        );
      })}
    </ul>
  );
}
```

- [ ] **Step 2: Wire the delete button into Home's list**

Replace `fe/src/pages/home/ui/home-page.tsx`:

```tsx
import { CreateContainerTrigger } from '@/features/container-create';
import { ContainerDeleteButton } from '@/features/container-delete';
import { ContainerList } from '@/features/container-list';

export function HomePage() {
  return (
    <div className='flex flex-1 flex-col items-center p-4'>
      <div className='flex w-full max-w-2xl flex-1 flex-col gap-6'>
        <ContainerList
          parentId={null}
          renderItemActions={child => (
            <ContainerDeleteButton
              containerId={child.id}
              parentId={null}
              containerName={child.name}
            />
          )}
        />
      </div>

      <CreateContainerTrigger parentId={null} />
    </div>
  );
}
```

- [ ] **Step 3: Wire the delete button into `ContainerByIdPage`'s list**

Modify `fe/src/pages/container-by-id/ui/container-by-id-page.tsx` (from Task 4) — add `renderItemActions` to the existing `<ContainerList>` call:

```tsx
<ContainerList
  parentId={id}
  renderItemActions={child => (
    <ContainerDeleteButton
      containerId={child.id}
      parentId={id}
      containerName={child.name}
    />
  )}
/>
```

(`ContainerDeleteButton` is already imported from Task 4's edit to this file.)

- [ ] **Step 4: Typecheck**

Run: `cd /Users/beforedisappear/dev/home-inventory/fe && npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 5: Commit**

Requires explicit user go-ahead first (see Global Constraints).

```bash
cd /Users/beforedisappear/dev/home-inventory && git add fe/src/features/container-list/ui/container-list.tsx fe/src/pages/home/ui/home-page.tsx fe/src/pages/container-by-id/ui/container-by-id-page.tsx && git commit -m "feat(fe): per-row container delete in the children list"
```

---

### Task 6: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Lint**

Run: `cd /Users/beforedisappear/dev/home-inventory/fe && bun run lint`
Expected: no errors.

- [ ] **Step 2: Build**

Run: `cd /Users/beforedisappear/dev/home-inventory/fe && bun run build`
Expected: no errors; `dist/` produced.

- [ ] **Step 3: Full manual pass (dev server + backend running)**

Run: `cd /Users/beforedisappear/dev/home-inventory/fe && bun run dev`

Build a small tree through the UI (no Swagger needed this time):
1. From Home, create a root container "Квартира".
2. Drill in, create a child "Кухня" with kind `room`.
3. Drill into "Кухня", create a child "Шкаф" with kind `cabinet` — confirm the kind select is narrowed correctly if a rule ends up attached (it won't be for UI-created containers per this plan's scope, so all 5 kinds will show — this is expected, not a bug; rule attachment is out of scope).
4. From the "Шкаф" row in "Кухня"'s list, click its delete icon → confirm dialog → cancel → dialog closes, row still there.
5. Click delete again → confirm → row disappears, no navigation (still on "Кухня").
6. Open "Кухня"'s own header delete button → confirm → navigates back to "Квартира", "Кухня" no longer in its list.
7. Try to delete "Квартира" while it still has no children (should succeed, navigates to Home) — then recreate a child under a fresh root and try deleting the *root* while it still has that child: expect the conflict toast ("Контейнер не пуст...") and the dialog stays open/root stays intact.

Stop the dev server when done.

---

## Self-Review

- **Spec coverage:** Event emitter infra — already committed, referenced not recreated (Global Constraints) ✓. Data layer (`create`/`delete` mutations, `services/container-rule`) — Task 1 ✓. `getAllowedKinds` smart kind filtering — Task 2 Step 2 ✓. Root creation has no kind field, no `ruleId` sent — Task 3 Step 2 (`parentId !== null &&` gates the kind field; `create-container-form` never renders/sends a `ruleId`) ✓. FAB triggers on both Home and `ContainerByIdPage` — Task 3 Steps 7–8 ✓. Global single modal via event emitter — Task 3 Step 3 ✓. Dead-end kind list (empty `allowedKinds`) disables submit + shows a message — Task 3 Step 2 (`isDeadEnd`) ✓. Self-delete in header with navigate-away — Task 4 ✓. Per-row delete without navigation — Task 5 ✓. Generic conflict toast (no error-body parsing) — Task 4 Step 1 and Task 5 Step 1, identical message ✓. No `ContainerRule` management UI — never introduced in any task ✓.
- **Placeholder scan:** none — every step has concrete, complete code or an exact command with expected output.
- **Type consistency:** `containerQueries.create()` / `.delete()` (Task 1 Step 4) match every call site (`use-create-container-form.ts` Task 2 Step 5, `container-header.tsx` Task 4 Step 1, `container-list-item.tsx` Task 5 Step 1) — `delete` mutation's `{ id, parentId }` variable shape is identical in both consumers. `containerRuleQueries.byId` (Task 1 Step 6) matches its only consumer (Task 2 Step 5). `getAllowedKinds(parentKind, rule)` (Task 2 Step 2) signature matches its call site (Task 2 Step 5: `getAllowedKinds(parent?.kind ?? null, rule ?? null)`). `createContainerEvents` (Task 2 Step 4) — same `open: { parentId }` event shape emitted in Task 3 Step 4 (`CreateContainerTrigger`) and consumed in Task 3 Step 3 (`CreateContainerModal`). `CreateContainerModal`/`CreateContainerTrigger` names match their barrel export (Task 3 Step 5) and their import sites in `protected-layout.tsx`/`home-page.tsx`/`container-by-id-page.tsx` (Task 3 Steps 6–8).
- **Trigger-nesting check:** every new `AlertDialog.Trigger` (Task 4, Task 5) and the existing `Dropdown.Trigger` fix are consistent — no HeroUI `Button` nested inside a Trigger anywhere in this plan; `CreateContainerTrigger`'s `Button` is a standalone FAB, not nested inside any Trigger component.
- **Known adjustable:** Task 3 Step 10's manual check assumes UI-created containers never get a `ruleId` (matches the spec's root-creation design), so the "smart" kind filtering will show all 5 kinds in every UI-driven test — this is correct behavior, not a gap; narrower kind lists only appear for containers whose parent chain was seeded with an explicit `ruleId` via the API directly (out of scope to test here).
