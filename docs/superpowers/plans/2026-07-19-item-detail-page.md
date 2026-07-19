# Item Detail Page (Foundation) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a dedicated `/items/$id` page as the canonical place for viewing and editing a single item, moving the edit trigger out of the container's item list row and onto this new page's header.

**Architecture:** Mirrors `ContainerByIdPage`/`ContainerHeader`'s shape but inline (no separate `ItemHeader` component, since nothing else renders below it on the same page). Reuses `ItemEdit` and `ItemDeleteTrigger` unchanged in shape — `ItemDeleteTrigger` only gains one new optional `onDeleted` prop so the detail page can navigate back to the parent container after a self-delete. `ItemList`'s row becomes a `Link` to the new page (mirrors `ContainerList`'s child-row `Link` exactly) and drops the pencil action — editing is now header-only.

**Tech Stack:** React + TanStack Router/Query + HeroUI (frontend only — no backend changes; `GET /items/:id` already exists and is already in the generated schema).

## Global Constraints

- All commands run from `fe/`: `bun run build`, `bun run lint`.
- Frontend types come from `@/kernel/api/schema` (`components['schemas'][...]`) — already up to date, no regeneration needed in this plan.
- All new frontend slices follow the existing FSD layout: `services/<domain>/api/*.ts` + `<domain>.queries.ts`; `kernel/<domain>/keys.ts` for query key builders; `pages/<name>/ui/<name>-page.tsx` + `index.ts` barrel.
- User-facing copy is in Russian, matching every existing feature.
- No unit-test runner on the frontend — verification is `bun run build` + `bun run lint` + one manual browser walkthrough per task where relevant (per project convention: one targeted pass, not exhaustive regression sweeps).
- Toast conventions unchanged (`toast.success`/`toast.danger`), no new toast copy needed in this plan.

---

### Task 1: Data layer — `itemQueries.byId` + `update()` gains a second invalidation

**Files:**
- Modify: `fe/src/kernel/item/keys.ts`
- Create: `fe/src/services/item/api/find-by-id.ts`
- Modify: `fe/src/services/item/api/item.queries.ts`

**Interfaces:**
- Consumes: `apiClient` from `@/shared/api/api-client`, `ItemResponseDto` from `@/kernel/api/schema`, existing `buildItemsByContainerKey` (`fe/src/kernel/item/keys.ts`).
- Produces: `buildItemByIdKey(id: string)`, `findItemByIdRequest(id: string): Promise<ItemResponseDto>`, `itemQueries.byId(id: string)` (queryOptions). `itemQueries.update()`'s `onSuccess` now additionally invalidates `buildItemByIdKey(vars.id)`. Consumed by Task 3's `ItemByIdPage`.

- [ ] **Step 1: Add the `byId` key builder**

```ts
// fe/src/kernel/item/keys.ts
export const buildItemsByContainerKey = (containerId: string) =>
  ['items', 'by-container', containerId] as const;

export const buildItemByIdKey = (id: string) => ['items', 'by-id', id] as const;
```

(only the new `buildItemByIdKey` export is added — `buildItemsByContainerKey` is unchanged)

- [ ] **Step 2: `find-by-id` request**

```ts
// fe/src/services/item/api/find-by-id.ts
import type { components } from '@/kernel/api/schema';
import { apiClient } from '@/shared/api/api-client';

type ItemResponseDto = components['schemas']['ItemResponseDto'];

export async function findItemByIdRequest(id: string): Promise<ItemResponseDto> {
  const { data, error } = await apiClient.GET('/api/v1/items/{id}', {
    params: { path: { id } },
  });

  if (error) throw error;

  return data!;
}
```

- [ ] **Step 3: Add `byId` to `itemQueries` and extend `update()`'s invalidation**

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
};
```

(only the `byId` entry and the second `invalidateQueries` call inside `update()`'s `onSuccess` are new — `create`/`delete` are unchanged)

- [ ] **Step 4: Typecheck + lint**

Run (from `fe/`): `bun run build && bun run lint`
Expected: no errors. `itemQueries.byId` isn't consumed anywhere yet, so no manual check here.

- [ ] **Step 5: Commit**

```bash
git add fe/src/kernel/item/keys.ts fe/src/services/item/api/find-by-id.ts fe/src/services/item/api/item.queries.ts
git commit -m "feat(fe): itemQueries.byId + update invalidates it"
```

---

### Task 2: `ItemDeleteTrigger` gains `onDeleted`

**Files:**
- Modify: `fe/src/features/item-delete/ui/item-delete-trigger.tsx`

**Interfaces:**
- Produces: `ItemDeleteTrigger` now accepts an optional `onDeleted?: () => void`, called right after `state.close()` on a successful delete. Existing callers that don't pass it behave exactly as before. Consumed by Task 3's `ItemByIdPage` (navigates back to the parent container) and unchanged for the list-row caller in `ContainerByIdPage`.

- [ ] **Step 1: Add the prop and call it on success**

```tsx
// fe/src/features/item-delete/ui/item-delete-trigger.tsx
import { Trash2 } from 'lucide-react';

import { useMutation } from '@tanstack/react-query';

import { itemQueries } from '@/services/item';

import { AlertDialog, Button, toast, useOverlayState } from '@/shared/ui';

interface Props {
  itemId: string;
  containerId: string;
  itemName: string;
  onDeleted?: () => void;
}

export function ItemDeleteTrigger(props: Props) {
  const { itemId, containerId, itemName, onDeleted } = props;
  const state = useOverlayState();

  const { mutateAsync: deleteItem, isPending: isDeleting } = useMutation(
    itemQueries.delete(),
  );

  const handleDelete = async () => {
    try {
      await deleteItem({ id: itemId, containerId });
      state.close();
      onDeleted?.();
    } catch {
      toast.danger('Не удалось удалить вещь');
    }
  };

  return (
    <>
      <button
        type='button'
        aria-label='Удалить вещь'
        className='flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-secondary hover:text-danger'
        onClick={state.open}
      >
        <Trash2 size={16} />
      </button>

      <AlertDialog.Root isOpen={state.isOpen} onOpenChange={state.setOpen}>
        <AlertDialog.Backdrop>
          <AlertDialog.Container>
            <AlertDialog.Dialog>
              <div className='flex items-center gap-3'>
                <AlertDialog.Icon />
                <AlertDialog.Header className='mb-0'>
                  <AlertDialog.Heading>
                    Удалить «{itemName}»?
                  </AlertDialog.Heading>
                </AlertDialog.Header>
              </div>
              <AlertDialog.Body className='mt-2'>
                Это действие нельзя отменить.
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button type='button' variant='ghost' onPress={state.close}>
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
    </>
  );
}
```

(only the `onDeleted` prop and its call site inside `handleDelete` are new)

- [ ] **Step 2: Typecheck + lint**

Run (from `fe/`): `bun run build && bun run lint`
Expected: no errors. `onDeleted` isn't passed anywhere yet, so no manual check here.

- [ ] **Step 3: Commit**

```bash
git add fe/src/features/item-delete/ui/item-delete-trigger.tsx
git commit -m "feat(fe): ItemDeleteTrigger onDeleted callback"
```

---

### Task 3: Routing + `ItemByIdPage`

**Files:**
- Modify: `fe/src/kernel/routes.ts`
- Modify: `fe/src/app/routes/router.tsx`
- Create: `fe/src/pages/item-by-id/ui/item-by-id-page.tsx`
- Create: `fe/src/pages/item-by-id/index.ts`

**Interfaces:**
- Consumes: `itemQueries.byId` (Task 1), `categoryQueries.list` (existing), `ItemEdit` (existing, unchanged), `ItemDeleteTrigger` with `onDeleted` (Task 2).
- Produces: `ROUTES.ITEM_BY_ID = '/items/$id'`, route registered as a child of `protectedRoute`, `ItemByIdPage` component. Consumed by Task 4's `ItemList` row `Link`.

- [ ] **Step 1: Add the route path constant**

```ts
// fe/src/kernel/routes.ts
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  PROFILE: '/profile',
  CONTAINER_BY_ID: '/containers/$id',
  ITEM_BY_ID: '/items/$id',
} as const;
```

- [ ] **Step 2: `ItemByIdPage` component**

```tsx
// fe/src/pages/item-by-id/ui/item-by-id-page.tsx
import { useQuery } from '@tanstack/react-query';
import { Link, useNavigate, useParams } from '@tanstack/react-router';
import { ChevronLeft } from 'lucide-react';

import { ItemDeleteTrigger } from '@/features/item-delete';
import { ItemEdit } from '@/features/item-edit';

import { categoryQueries } from '@/services/category';
import { itemQueries } from '@/services/item';

import { ROUTES } from '@/kernel/routes';

import { Chip, ErrorState, Skeleton, Typography } from '@/shared/ui';

export function ItemByIdPage() {
  const { id } = useParams({ from: '/protected/items/$id' });
  const navigate = useNavigate();

  const {
    data: item,
    isPending,
    isError,
    refetch,
  } = useQuery(itemQueries.byId(id));

  const { data: categories } = useQuery(categoryQueries.list());

  if (isPending) {
    return (
      <div className='flex flex-1 flex-col items-center p-4'>
        <div className='flex w-full max-w-2xl flex-1 flex-col gap-6'>
          <div className='flex flex-col gap-2 border-b border-border pb-4'>
            <Skeleton className='h-6 w-24' />
            <Skeleton className='h-8 w-48' />
          </div>
        </div>
      </div>
    );
  }

  if (isError || !item) {
    return (
      <div className='flex flex-1 flex-col items-center p-4'>
        <div className='flex w-full max-w-2xl flex-1 flex-col gap-6'>
          <ErrorState onRetry={() => refetch()}>
            Не удалось загрузить вещь
          </ErrorState>
        </div>
      </div>
    );
  }

  const categoryName = item.categoryId
    ? (categories ?? []).find(category => category.id === item.categoryId)?.name
    : undefined;

  const handleNavigateToContainer = () => {
    void navigate({
      to: ROUTES.CONTAINER_BY_ID,
      params: { id: item.containerId },
    });
  };

  return (
    <div className='flex flex-1 flex-col items-center p-4'>
      <div className='flex w-full max-w-2xl flex-1 flex-col gap-6'>
        <div className='flex flex-col gap-2 border-b border-border pb-4'>
          <Link
            to={ROUTES.CONTAINER_BY_ID}
            params={{ id: item.containerId }}
            className='inline-flex w-fit items-center gap-1'
          >
            <ChevronLeft size={16} />
            <Typography type='body-sm' color='muted'>
              Назад к контейнеру
            </Typography>
          </Link>

          <div className='flex items-center justify-between gap-2'>
            <Typography.Heading level={3} truncate>
              {item.name}
            </Typography.Heading>

            <div className='flex shrink-0 items-center gap-2'>
              <ItemEdit item={item} containerId={item.containerId} />
              <ItemDeleteTrigger
                itemId={item.id}
                containerId={item.containerId}
                itemName={item.name}
                onDeleted={handleNavigateToContainer}
              />
            </div>
          </div>
        </div>

        <div className='flex flex-col gap-2'>
          {categoryName && <Chip size='sm'>{categoryName}</Chip>}
          <Typography type='body-sm'>Количество: {item.quantity}</Typography>
          {item.description && (
            <Typography type='body-sm' color='muted'>
              {item.description}
            </Typography>
          )}
        </div>
      </div>
    </div>
  );
}
```

```ts
// fe/src/pages/item-by-id/index.ts
export { ItemByIdPage } from './ui/item-by-id-page';
```

- [ ] **Step 3: Register the route**

```tsx
// fe/src/app/routes/router.tsx
import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from '@tanstack/react-router';

import { ContainerByIdPage } from '@/pages/container-by-id';
import { HomePage } from '@/pages/home';
import { ItemByIdPage } from '@/pages/item-by-id';
import { LoginPage } from '@/pages/login';
import { UserProfilePage } from '@/pages/user-profile';

import { ROUTES } from '@/kernel/routes';

import { tokenStorage } from '@/shared/api/token-storage';

import { ProtectedLayout } from '../layouts/protected-layout';
import { RootLayout } from '../layouts/root-layout';

// Регистрируем типы (чтобы роутер работал с TS без костылей)
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

const rootRoute = createRootRoute({ component: RootLayout });

const protectedRoute = createRoute({
  id: 'protected',
  getParentRoute: () => rootRoute,
  component: ProtectedLayout,
  beforeLoad: () => {
    if (!tokenStorage.getAccess()) {
      throw redirect({ to: ROUTES.LOGIN });
    }
  },
});

const indexRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: ROUTES.HOME,
  component: HomePage,
});

const profileRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: ROUTES.PROFILE,
  component: UserProfilePage,
});

const containerByIdRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: ROUTES.CONTAINER_BY_ID,
  component: ContainerByIdPage,
});

const itemByIdRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: ROUTES.ITEM_BY_ID,
  component: ItemByIdPage,
});

const protectedRoutes = protectedRoute.addChildren([
  indexRoute,
  profileRoute,
  containerByIdRoute,
  itemByIdRoute,
]);

const publicRoutes = [
  createRoute({
    getParentRoute: () => rootRoute,
    path: ROUTES.LOGIN,
    component: LoginPage,
    beforeLoad: () => {
      if (tokenStorage.getAccess()) {
        throw redirect({ to: ROUTES.HOME });
      }
    },
  }),
];

const routeTree = rootRoute.addChildren([protectedRoutes, ...publicRoutes]);

export const router = createRouter({ routeTree });
```

(only the `ItemByIdPage` import, the `itemByIdRoute` declaration, and its entry in `protectedRoutes` are new)

- [ ] **Step 4: Typecheck + lint**

Run (from `fe/`): `bun run build && bun run lint`
Expected: no errors.

- [ ] **Step 5: Manual check**

With `fe-dev`/`be-dev` running, log in, open a container that has at least one item, then manually navigate the browser to `http://localhost:5173/items/<id>` using an item's id (grab it from the network tab or from `GET /api/v1/items?containerId=...`). Confirm: back-link goes to the right container, item name renders as the heading, quantity/category/description render correctly, edit (pencil) and delete (trash) actions appear in the header and both still work (edit saves and the page reflects the change without a manual reload; delete navigates back to the container). This is the only manual entry point until Task 4 wires the list-row link.

- [ ] **Step 6: Commit**

```bash
git add fe/src/kernel/routes.ts fe/src/app/routes/router.tsx fe/src/pages/item-by-id
git commit -m "feat(fe): item detail page + /items/\$id route"
```

---

### Task 4: `ItemList` row links to the detail page; list-row edit action removed

**Files:**
- Modify: `fe/src/features/item-list/ui/item-list.tsx`
- Modify: `fe/src/pages/container-by-id/ui/container-by-id-page.tsx`

**Interfaces:**
- Consumes: `ROUTES.ITEM_BY_ID` (Task 3), `ItemDeleteTrigger` (existing, `onDeleted` left unset here — unchanged list-row behavior).
- Produces: `ItemList`'s per-item row name/icon/badges are now a `Link` to `/items/$id`. `ContainerByIdPage`'s `renderItemActions` for items no longer renders `ItemEdit`.

- [ ] **Step 1: Wrap the row content in a `Link`**

```tsx
// fe/src/features/item-list/ui/item-list.tsx
import type { ReactNode } from 'react';

import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { Box } from 'lucide-react';

import { categoryQueries } from '@/services/category';
import { itemQueries } from '@/services/item';

import type { components } from '@/kernel/api/schema';
import { ROUTES } from '@/kernel/routes';

import { Button, Chip, Typography } from '@/shared/ui';

type ItemResponseDto = components['schemas']['ItemResponseDto'];

interface Props {
  containerId: string;
  renderItemActions?: (item: ItemResponseDto) => ReactNode;
}

export function ItemList({ containerId, renderItemActions }: Props) {
  const {
    data: items,
    isPending,
    isError,
    refetch,
  } = useQuery(itemQueries.byContainer(containerId));

  const { data: categories } = useQuery(categoryQueries.list());

  if (isPending) return null;

  if (isError) {
    return (
      <div className='flex items-center justify-between gap-2 rounded-lg border border-dashed border-danger/40 px-4 py-3'>
        <Typography type='body-sm' color='muted'>
          Не удалось загрузить вещи
        </Typography>
        <Button type='button' variant='ghost' size='sm' onPress={() => refetch()}>
          Повторить
        </Button>
      </div>
    );
  }

  const categoryNameById = new Map(
    (categories ?? []).map(category => [category.id, category.name]),
  );

  return (
    <>
      {items.map(item => (
        <div
          key={item.id}
          className='flex items-center gap-2 rounded-lg border border-border bg-surface px-4 py-3'
        >
          <Link
            to={ROUTES.ITEM_BY_ID}
            params={{ id: item.id }}
            className='flex min-w-0 flex-1 items-center gap-3'
          >
            <Box size={18} className='shrink-0 text-muted' />
            <Typography truncate>{item.name}</Typography>
            {item.quantity !== 1 && <Chip size='sm'>× {item.quantity}</Chip>}
            {item.categoryId && categoryNameById.has(item.categoryId) && (
              <Chip size='sm'>{categoryNameById.get(item.categoryId)}</Chip>
            )}
          </Link>

          {renderItemActions?.(item)}
        </div>
      ))}
    </>
  );
}
```

(the icon/name/badges that used to live in a plain `<span>` inside the row now live inside a `Link`; nothing else in the row changes)

- [ ] **Step 2: Drop `ItemEdit` from the list row's actions**

```tsx
// fe/src/pages/container-by-id/ui/container-by-id-page.tsx
import { useNavigate, useParams } from '@tanstack/react-router';

import { ContainerHeader } from '@/features/container';
import { CreateContainer } from '@/features/container-create';
import {
  ContainerDeleteDialog,
  ContainerDeleteTrigger,
} from '@/features/container-delete';
import { ContainerEdit } from '@/features/container-edit';
import { ContainerList } from '@/features/container-list';
import { CreateItem } from '@/features/item-create';
import { ItemDeleteTrigger } from '@/features/item-delete';
import { ItemList } from '@/features/item-list';

import { ROUTES } from '@/kernel/routes';

export function ContainerByIdPage() {
  const { id } = useParams({ from: '/protected/containers/$id' });
  const navigate = useNavigate();

  return (
    <div className='flex flex-1 flex-col items-center p-4'>
      <div className='flex w-full max-w-2xl flex-1 flex-col gap-6'>
        <ContainerHeader
          parentId={id}
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
                <ContainerEdit
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
        />

        <ContainerList
          parentId={id}
          renderItemActions={child => (
            <ContainerDeleteTrigger
              containerId={child.id}
              parentId={id}
              containerName={child.name}
            />
          )}
        >
          <ItemList
            containerId={id}
            renderItemActions={item => (
              <ItemDeleteTrigger
                itemId={item.id}
                containerId={id}
                itemName={item.name}
              />
            )}
          />
          <CreateItem containerId={id} />
        </ContainerList>
      </div>

      <ContainerDeleteDialog />
    </div>
  );
}
```

(the `ItemEdit` import and its element inside `renderItemActions` are removed; everything else is unchanged)

- [ ] **Step 3: Typecheck + lint**

Run (from `fe/`): `bun run build && bun run lint`
Expected: no errors.

- [ ] **Step 4: Manual check**

Open a container with at least one item. Confirm: the item row no longer shows a pencil icon, only the trash icon; clicking the item's name/icon area navigates to `/items/<id>` and renders the detail page (back-link, name, quantity, category, description); the browser back button returns to the container with the list intact. From the container's list row, delete an item via the trash icon exactly as before (unaffected by this change).

- [ ] **Step 5: Commit**

```bash
git add fe/src/features/item-list/ui/item-list.tsx fe/src/pages/container-by-id/ui/container-by-id-page.tsx
git commit -m "feat(fe): item list rows link to the detail page, drop row-level edit"
```

---

### Task 5: Final verification

**Files:** none (verification only)

- [ ] **Step 1: Full build + lint**

Run: `cd fe && bun run build && bun run lint`
Expected: no errors.

- [ ] **Step 2: End-to-end manual walkthrough**

Starting from a container with two or more items: click an item to open its detail page; edit it from the header (change name, category, quantity, description) and confirm the page updates without a manual reload; navigate back to the container and confirm the list row reflects the edit; open the item again and delete it from the header, confirming navigation lands back on the correct container and the item is gone from the list; confirm the list row's pencil icon is gone everywhere (only trash remains) and per-row delete still works independently of the detail page.

- [ ] **Step 3: Report completion**

Summarize what was built. Note that Photos and Custom Fields sections remain out of scope (future specs, per `docs/superpowers/specs/2026-07-19-item-detail-page-design.md`).
