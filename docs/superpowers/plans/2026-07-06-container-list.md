# Container List (Browsing) Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Read-only navigation through the container tree — HOME lists root containers, `/containers/$id` lists a container's children with a one-level "← Назад" link. No create/edit/delete/move UI.

**Architecture:** `services/container` adds a `containerQueries` factory (mirrors `services/user`) wrapping the two already-generated read endpoints (`GET /containers?parentId=`, `GET /containers/{id}`). `features/container-list` owns the list-rendering (icon-per-`kind`, loading/empty/error states) as `ContainerList`, plus small `kind → icon` / `kind → label` lookup helpers. `pages/home` renders `<ContainerList parentId={null} />`; the new `pages/container-by-id` reads `id` from the route, fetches the container itself directly (for the header + back-link target), and renders `<ContainerList parentId={id} />` below it. One new child route under the existing `protectedRoute`.

**Tech Stack:** React 19, TanStack Router/Query, Tailwind v4, lucide-react, Bun.

## Global Constraints

- No test framework in this repo. Per-task gate is a typecheck: `cd /Users/beforedisappear/dev/home-inventory/fe && npx tsc -b --noEmit`. Final gate: `bun run lint && bun run build`.
- Style: single quotes, semicolons, no unnecessary comments (only WHY-comments, matching surrounding files).
- FSD layer order `app → pages → features → services → kernel → shared` — no upward imports. Cross-slice consumers only import through a slice's `index.ts` barrel, never a deep internal path.
- Work directly on `main`. No branches/worktrees.
- Run `bun`/`tsc` from `fe/` with an absolute `cd` prefix (cwd resets between shell calls). Run `git` from repo root `/Users/beforedisappear/dev/home-inventory`.
- Commit messages: no `Co-Authored-By` / AI attribution.
- **Never run `git commit` without the user's explicit go-ahead for that specific commit** — this overrides the per-task "Commit" steps below. Confirm with the user before executing any Commit step.
- No backend/API changes — `GET /api/v1/containers` and `GET /api/v1/containers/{id}` already exist and are already in the generated `fe/src/kernel/api/schema.ts`.
- No create/edit/delete/move UI, no `container-rules` UI, no item/child counts per row, no items browsing, no full breadcrumb trail (only a single one-level-up "← Назад" link) — all per the approved spec (`docs/superpowers/specs/2026-07-06-container-list-design.md`).

---

### Task 1: `services/container` + `ContainerList` + wire into HOME

Data layer for both endpoints, the shared list-rendering component, and its first real consumer (the home page). This is the first point where the feature is visually verifiable.

**Files:**
- Create: `fe/src/kernel/container/keys.ts`
- Create: `fe/src/services/container/api/find-children.ts`
- Create: `fe/src/services/container/api/find-by-id.ts`
- Create: `fe/src/services/container/api/container.queries.ts`
- Create: `fe/src/services/container/index.ts`
- Create: `fe/src/features/container-list/model/container-kind-icon.ts`
- Create: `fe/src/features/container-list/model/container-kind-label.ts`
- Create: `fe/src/features/container-list/ui/container-list.tsx`
- Create: `fe/src/features/container-list/index.ts`
- Modify: `fe/src/pages/home/ui/home-page.tsx` (full rewrite)

**Interfaces:**
- Consumes: `apiClient` from `@/shared/api/api-client` (existing `openapi-fetch` client); `components` types from `@/kernel/api/schema` (existing, generated); `ErrorMessage`, `Skeleton`, `Typography` from `@/shared/ui` (existing).
- Produces: `containerQueries.children(parentId: string | null)` and `containerQueries.byId(id: string)` (both `queryOptions`, exported from `@/services/container`); `ContainerList` component (`{ parentId: string | null }` prop), `getContainerKindLabel(kind)` — both exported from `@/features/container-list`.

- [ ] **Step 1: Query keys**

Create `fe/src/kernel/container/keys.ts`:

```ts
export const buildContainerChildrenKey = (parentId: string | null) =>
  ['container', 'children', parentId] as const;

export const buildContainerByIdKey = (id: string) => ['container', id] as const;
```

- [ ] **Step 2: `findChildren` request**

Create `fe/src/services/container/api/find-children.ts`:

```ts
import type { components } from '@/kernel/api/schema';
import { apiClient } from '@/shared/api/api-client';

type ContainerResponseDto = components['schemas']['ContainerResponseDto'];

export async function findChildrenRequest(
  parentId: string | null,
): Promise<ContainerResponseDto[]> {
  const { data, error } = await apiClient.GET('/api/v1/containers', {
    params: { query: { parentId: parentId ?? undefined } },
  });

  if (error) throw error;

  return data!;
}
```

- [ ] **Step 3: `findById` request**

Create `fe/src/services/container/api/find-by-id.ts`:

```ts
import type { components } from '@/kernel/api/schema';
import { apiClient } from '@/shared/api/api-client';

type ContainerResponseDto = components['schemas']['ContainerResponseDto'];

export async function findContainerByIdRequest(
  id: string,
): Promise<ContainerResponseDto> {
  const { data, error } = await apiClient.GET('/api/v1/containers/{id}', {
    params: { path: { id } },
  });

  if (error) throw error;

  return data!;
}
```

- [ ] **Step 4: Query factory**

Create `fe/src/services/container/api/container.queries.ts`:

```ts
import { queryOptions } from '@tanstack/react-query';

import {
  buildContainerByIdKey,
  buildContainerChildrenKey,
} from '@/kernel/container/keys';

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
};
```

- [ ] **Step 5: Barrel**

Create `fe/src/services/container/index.ts`:

```ts
export { containerQueries } from './api/container.queries';
```

- [ ] **Step 6: Typecheck the data layer**

Run: `cd /Users/beforedisappear/dev/home-inventory/fe && npx tsc -b --noEmit`
Expected: no errors.

- [ ] **Step 7: Kind → icon lookup**

Create `fe/src/features/container-list/model/container-kind-icon.ts`:

```ts
import { Archive, DoorOpen, Home, Inbox, Package, ShoppingBag } from 'lucide-react';

import type { components } from '@/kernel/api/schema';

type ContainerKind = components['schemas']['ContainerResponseDto']['kind'];

const CONTAINER_KIND_ICON = {
  room: DoorOpen,
  cabinet: Archive,
  drawer: Inbox,
  box: Package,
  bag: ShoppingBag,
} as const;

export function getContainerKindIcon(kind: ContainerKind) {
  return kind ? CONTAINER_KIND_ICON[kind] : Home;
}
```

- [ ] **Step 8: Kind → label lookup**

Create `fe/src/features/container-list/model/container-kind-label.ts`:

```ts
import type { components } from '@/kernel/api/schema';

type ContainerKind = components['schemas']['ContainerResponseDto']['kind'];

const CONTAINER_KIND_LABEL = {
  room: 'Комната',
  cabinet: 'Шкаф',
  drawer: 'Ящик',
  box: 'Коробка',
  bag: 'Сумка',
} as const;

export function getContainerKindLabel(kind: ContainerKind) {
  return kind ? CONTAINER_KIND_LABEL[kind] : null;
}
```

- [ ] **Step 9: `ContainerList` component**

Create `fe/src/features/container-list/ui/container-list.tsx`:

```tsx
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';
import { ChevronRight } from 'lucide-react';

import { containerQueries } from '@/services/container';

import { ROUTES } from '@/kernel/routes';

import { ErrorMessage, Skeleton, Typography } from '@/shared/ui';

import { getContainerKindIcon } from '../model/container-kind-icon';

interface ContainerListProps {
  parentId: string | null;
}

export function ContainerList(props: ContainerListProps) {
  const { data, isPending, isError } = useQuery(
    containerQueries.children(props.parentId),
  );

  if (isPending) {
    return (
      <div className='flex flex-col gap-2'>
        <Skeleton className='h-12 w-full rounded-lg' />
        <Skeleton className='h-12 w-full rounded-lg' />
        <Skeleton className='h-12 w-full rounded-lg' />
      </div>
    );
  }

  if (isError) {
    return <ErrorMessage>Не удалось загрузить контейнеры</ErrorMessage>;
  }

  if (data.length === 0) {
    return (
      <Typography type='body-sm' color='muted'>
        Здесь пока пусто
      </Typography>
    );
  }

  return (
    <ul className='flex flex-col gap-2'>
      {data.map(container => {
        const Icon = getContainerKindIcon(container.kind);

        return (
          <li key={container.id}>
            <Link
              to={ROUTES.CONTAINER_BY_ID}
              params={{ id: container.id }}
              className='flex items-center justify-between gap-3 rounded-lg border border-border bg-surface px-4 py-3 transition-colors hover:bg-surface-secondary'
            >
              <span className='flex items-center gap-3'>
                <Icon size={18} className='text-muted' />
                <Typography>{container.name}</Typography>
              </span>
              <ChevronRight size={16} className='text-muted' />
            </Link>
          </li>
        );
      })}
    </ul>
  );
}
```

Note: `ROUTES.CONTAINER_BY_ID` doesn't exist yet — it's added in Task 2. This file will fail to typecheck until then; that's expected and checked at the end of Task 2, not here.

- [ ] **Step 10: Barrel**

Create `fe/src/features/container-list/index.ts`:

```ts
export { getContainerKindLabel } from './model/container-kind-label';
export { ContainerList } from './ui/container-list';
```

- [ ] **Step 11: Wire into HOME**

Replace `fe/src/pages/home/ui/home-page.tsx`:

```tsx
import { ContainerList } from '@/features/container-list';

export function HomePage() {
  return (
    <div className='flex flex-1 flex-col items-center p-4'>
      <div className='w-full max-w-2xl'>
        <ContainerList parentId={null} />
      </div>
    </div>
  );
}
```

- [ ] **Step 12: Commit**

Requires explicit user go-ahead first (see Global Constraints).

```bash
cd /Users/beforedisappear/dev/home-inventory && git add fe/src/kernel/container fe/src/services/container fe/src/features/container-list fe/src/pages/home/ui/home-page.tsx && git commit -m "feat(fe): list root containers on the home page"
```

---

### Task 2: `/containers/$id` route + `ContainerByIdPage`

Adds the dynamic route and the page that shows a single container's header (name + kind + back-link) plus its children via the `ContainerList` built in Task 1.

**Files:**
- Modify: `fe/src/kernel/routes.ts` (full rewrite)
- Modify: `fe/src/app/routes/router.tsx` (full rewrite)
- Create: `fe/src/pages/container-by-id/ui/container-by-id-page.tsx`
- Create: `fe/src/pages/container-by-id/index.ts`

**Interfaces:**
- Consumes: `containerQueries.byId` from `@/services/container` (Task 1); `ContainerList`, `getContainerKindLabel` from `@/features/container-list` (Task 1); `ROUTES` from `@/kernel/routes`.
- Produces: `ROUTES.CONTAINER_BY_ID = '/containers/$id'`; `ContainerByIdPage` component exported from `@/pages/container-by-id`; a route at `path: ROUTES.CONTAINER_BY_ID` as a child of `protectedRoute`.

- [ ] **Step 1: Add the route constant**

Replace `fe/src/kernel/routes.ts`:

```ts
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  PROFILE: '/profile',
  CONTAINER_BY_ID: '/containers/$id',
} as const;
```

- [ ] **Step 2: `ContainerByIdPage`**

Create `fe/src/pages/container-by-id/ui/container-by-id-page.tsx`:

```tsx
import { useQuery } from '@tanstack/react-query';
import { Link, useParams } from '@tanstack/react-router';
import { ChevronLeft } from 'lucide-react';

import { containerQueries } from '@/services/container';

import { ROUTES } from '@/kernel/routes';

import { getContainerKindLabel, ContainerList } from '@/features/container-list';

import { ErrorMessage, Skeleton, Typography } from '@/shared/ui';

export function ContainerByIdPage() {
  const { id } = useParams({ from: ROUTES.CONTAINER_BY_ID });

  const {
    data: container,
    isPending,
    isError,
  } = useQuery(containerQueries.byId(id));

  return (
    <div className='flex flex-1 flex-col items-center p-4'>
      <div className='w-full max-w-2xl'>
        <div className='mb-6 flex flex-col gap-2'>
          {isPending ? (
            <Skeleton className='h-8 w-48' />
          ) : isError || !container ? (
            <>
              <ErrorMessage>Не удалось загрузить контейнер</ErrorMessage>
              <Link to={ROUTES.HOME}>
                <Typography type='body-sm' color='muted'>
                  На главную
                </Typography>
              </Link>
            </>
          ) : (
            <>
              {container.parentId ? (
                <Link
                  to={ROUTES.CONTAINER_BY_ID}
                  params={{ id: container.parentId }}
                  className='inline-flex w-fit items-center gap-1'
                >
                  <ChevronLeft size={16} />
                  <Typography type='body-sm' color='muted'>
                    Назад
                  </Typography>
                </Link>
              ) : (
                <Link
                  to={ROUTES.HOME}
                  className='inline-flex w-fit items-center gap-1'
                >
                  <ChevronLeft size={16} />
                  <Typography type='body-sm' color='muted'>
                    Назад
                  </Typography>
                </Link>
              )}

              <div className='flex items-center gap-2'>
                <Typography.Heading level={3}>{container.name}</Typography.Heading>
                {getContainerKindLabel(container.kind) && (
                  <Typography type='body-sm' color='muted'>
                    {getContainerKindLabel(container.kind)}
                  </Typography>
                )}
              </div>
            </>
          )}
        </div>

        <ContainerList parentId={id} />
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Barrel**

Create `fe/src/pages/container-by-id/index.ts`:

```ts
export { ContainerByIdPage } from './ui/container-by-id-page';
```

- [ ] **Step 4: Wire the route**

Replace `fe/src/app/routes/router.tsx`:

```tsx
import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from '@tanstack/react-router';

import { ContainerByIdPage } from '@/pages/container-by-id';
import { HomePage } from '@/pages/home';
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

const protectedRoutes = protectedRoute.addChildren([
  indexRoute,
  profileRoute,
  containerByIdRoute,
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

- [ ] **Step 5: Typecheck**

Run: `cd /Users/beforedisappear/dev/home-inventory/fe && npx tsc -b --noEmit`
Expected: no errors — this also confirms `ContainerList`'s `Link to={ROUTES.CONTAINER_BY_ID}` from Task 1 now resolves correctly.

- [ ] **Step 6: Commit**

Requires explicit user go-ahead first (see Global Constraints).

```bash
cd /Users/beforedisappear/dev/home-inventory && git add fe/src/kernel/routes.ts fe/src/app/routes/router.tsx fe/src/pages/container-by-id && git commit -m "feat(fe): add container detail page with child list and back link"
```

---

### Task 3: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Lint**

Run: `cd /Users/beforedisappear/dev/home-inventory/fe && bun run lint`
Expected: no errors.

- [ ] **Step 2: Build**

Run: `cd /Users/beforedisappear/dev/home-inventory/fe && bun run build`
Expected: no errors; `dist/` produced.

- [ ] **Step 3: Seed a small container tree via Swagger**

The backend has no container-creation UI dependency for this feature, but there's also no data yet. With the backend running (`http://localhost:3000`), open `http://localhost:3000/swagger` and use `POST /api/v1/containers` (authenticated) to create:
1. A root container, e.g. `{ "name": "Квартира" }` (no `kind`, no `parentId`).
2. A child of it, e.g. `{ "name": "Гостиная", "kind": "room", "parentId": "<root id>" }`.
3. A child of the room, e.g. `{ "name": "Шкаф", "kind": "cabinet", "parentId": "<room id>" }`.

- [ ] **Step 4: Full manual pass (dev server)**

Run: `cd /Users/beforedisappear/dev/home-inventory/fe && bun run dev`

Walk through:
- HOME lists the root container ("Квартира") — icon shown is the `Home` fallback (root has no `kind`).
- Click it → `/containers/$id` shows the header "Квартира" (no kind badge, since root), "← Назад" pointing at HOME, and the room ("Гостиная") in the child list with the `DoorOpen` icon.
- Click the room → header shows "Гостиная" + "Комната" badge, "← Назад" pointing back at the apartment page, child list shows the cabinet ("Шкаф") with the `Archive` icon.
- Click the cabinet → header shows "Шкаф" + "Шкаф" badge, "← Назад" pointing back at the room, child list is empty → "Здесь пока пусто".
- Follow "← Назад" all the way back to HOME and confirm each hop lands on the expected level.
- Visit a `/containers/$id` with a made-up id directly (bad id) → header shows the error state + "На главную" link, and the child list below independently shows its own error/empty state without crashing the page.

Stop the dev server when done.

---

## Self-Review

- **Spec coverage:** browse-only scope (no create/edit/delete/move/rules UI) — nothing added beyond `containerQueries.children`/`byId` reads, matches spec's Non-Goals ✓. Routing (`ROUTES.CONTAINER_BY_ID`, child route) — Task 2 ✓. Data flow (`services/container` mirroring `services/user`) — Task 1 ✓. `ContainerList` states (pending/error/empty/success, kind icon, no per-row kind label) — Task 1 Step 9 ✓. `ContainerByIdPage` header (name + kind badge, one-level back-link derived from `container.parentId`, no ancestor-chain walking) — Task 2 Step 2 ✓. Error handling (list error → `ErrorMessage`; `byId` error → static "На главную" fallback) — Task 2 Step 2 ✓. Manual verification walkthrough — Task 3 ✓.
- **Placeholder scan:** none — every step has concrete, complete code or an exact command with expected output.
- **Type consistency:** `containerQueries.children(parentId: string | null)` / `containerQueries.byId(id: string)` (Task 1 Step 4) match every consumer call site (`ContainerList` Task 1 Step 9, `ContainerByIdPage` Task 2 Step 2). `getContainerKindLabel`/`getContainerKindIcon` names match between their definition files (Task 1 Steps 7–8) and their barrel re-export (Task 1 Step 10) and the page's import (Task 2 Step 2). `ROUTES.CONTAINER_BY_ID` string literal (`'/containers/$id'`) is identical between `kernel/routes.ts` (Task 2 Step 1), `router.tsx`'s `containerByIdRoute.path` (Task 2 Step 4), and every `Link to={ROUTES.CONTAINER_BY_ID}` / `useParams({ from: ROUTES.CONTAINER_BY_ID })` call site (Task 1 Step 9, Task 2 Step 2) — required for TanStack Router's route-string type inference to resolve `params`/`useParams` correctly.
- **Known adjustable:** Task 1's `ContainerList` references `ROUTES.CONTAINER_BY_ID` before it exists (added in Task 2) — flagged inline in Task 1 Step 9 as an expected, temporary typecheck failure, resolved by Task 2 Step 5's typecheck gate.
