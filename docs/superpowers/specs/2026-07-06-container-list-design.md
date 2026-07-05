# Container List (Browsing) — Design

**Date:** 2026-07-06
**Scope:** Browse-only navigation through the container tree (rooms/cabinets/drawers/boxes/bags). HOME shows root containers; drilling into one shows its children on a dedicated page. No create/edit/delete/move UI, no rules UI, no items — those are separate future features. Backend already exposes everything needed — no API changes.

## Goal

`HomePage` is currently a stub (`return null`). The backend already has full container support (`ContainerController`, hierarchical `parentId`/`rootId`, `kind` per non-root node, nesting rules via `container-rules`), but nothing on the frontend consumes it. This adds read-only navigation:

- `GET /api/v1/containers?parentId=` — list containers at one level (omit `parentId` → root containers).
- `GET /api/v1/containers/{id}` — a single container (used for the current container's own name/kind and its `parentId`).

## Non-Goals

- No container creation, editing, deletion, or move UI (`POST /containers`, `PATCH`, `DELETE`, `POST /containers/{id}/move` are all out of scope for this slice).
- No `container-rules` UI (kind-nesting validation is a backend concern for the create/move features, not for browsing).
- No item counts or child counts shown per row — `ContainerResponseDto` doesn't include them, and fetching them separately would mean N extra requests per row. Deferred until it's actually needed.
- No items browsing inside a leaf container — that's the `items` feature, built separately later.
- No full breadcrumb trail. Only a single "← Назад" link one level up, computed directly from the current container's own `parentId` (no walking the ancestor chain via repeated `byId` calls).

## Routing

- `kernel/routes.ts` — add `CONTAINER_BY_ID: '/containers/$id'` to `ROUTES`.
- `app/routes/router.tsx` — add a child route of `protectedRoute`:
  ```ts
  const containerByIdRoute = createRoute({
    getParentRoute: () => protectedRoute,
    path: ROUTES.CONTAINER_BY_ID,
    component: ContainerByIdPage,
  });
  ```
  added alongside `indexRoute`/`profileRoute` in `protectedRoute.addChildren([...])`.
- `pages/home/ui/home-page.tsx` — no longer a stub; renders `<ContainerList parentId={null} />`.

## Data Flow

**New — `services/container`** (mirrors `services/user` structure):
- `api/find-children.ts` — `findChildrenRequest(parentId: string | null)` → `GET /api/v1/containers` with `{ query: { parentId } }` when `parentId` is set, `{ query: {} }` (no param) when listing roots.
- `api/find-by-id.ts` — `findContainerByIdRequest(id: string)` → `GET /api/v1/containers/{id}`.
- `api/container.queries.ts` — `containerQueries` factory:
  - `children: (parentId: string | null) => queryOptions({ queryKey: ['container', 'children', parentId], queryFn: () => findChildrenRequest(parentId) })`
  - `byId: (id: string) => queryOptions({ queryKey: ['container', id], queryFn: () => findContainerByIdRequest(id) })`
- `index.ts` — barrel exporting `containerQueries`.

**HOME:** `<ContainerList parentId={null} />` → `useQuery(containerQueries.children(null))`.

**`/containers/$id`:** `ContainerByIdPage` reads `id` from route params, calls `useQuery(containerQueries.byId(id))` for the current container's own name/kind/`parentId`, then renders `<ContainerList parentId={id} />` for its children (a second, independent query).

**Back link:** derived directly from the already-fetched current container, no extra request:
- `container.parentId` set → `Link to={ROUTES.CONTAINER_BY_ID} params={{ id: container.parentId }}`
- `container.parentId === null` (current container is itself a root) → `Link to={ROUTES.HOME}`

## Components & Files

**New — `services/container`:** as described above under Data Flow.

**New — `features/container-list`:**
- `model/container-kind-icon.ts` — maps `ContainerResponseDto['kind']` (including `null` for root containers) to a `lucide-react` icon component:
  ```ts
  import { Archive, DoorOpen, Home, Inbox, Package, ShoppingBag } from 'lucide-react';

  export const CONTAINER_KIND_ICON = {
    room: DoorOpen,
    cabinet: Archive,
    drawer: Inbox,
    box: Package,
    bag: ShoppingBag,
  } as const;

  export function getContainerKindIcon(kind: 'room' | 'cabinet' | 'drawer' | 'box' | 'bag' | null) {
    return kind ? CONTAINER_KIND_ICON[kind] : Home;
  }
  ```
- `model/container-kind-label.ts` — Russian label per kind (`room` → "Комната", `cabinet` → "Шкаф", `drawer` → "Ящик", `box` → "Коробка", `bag` → "Сумка"), `null` → no label (or "Контейнер").
- `ui/container-list.tsx` — `interface Props { parentId: string | null }`. `useQuery(containerQueries.children(parentId))`. States:
  - pending → a handful of `Skeleton` rows
  - error → `ErrorMessage`
  - empty (`data.length === 0`) → text "Здесь пока пусто", same message regardless of `parentId` (root vs. nested) — no need for two variants in v1
  - success → list of rows, each a `Link` to `ROUTES.CONTAINER_BY_ID` with `params={{ id: container.id }}`, showing the kind icon + name + trailing `ChevronRight`. Rows show only the icon, not the kind text label (see below) — the label is reserved for the page header, where there's a single container to describe instead of a list of mixed kinds.
- `index.ts` — barrel exporting `ContainerList`.

**New — `pages/container-by-id`:**
- `ui/container-by-id-page.tsx` — `ContainerByIdPage`. Reads `id` via the route's `useParams()`. `useQuery(containerQueries.byId(id))` for the header and back-link target. Renders `<ContainerList parentId={id} />` below.
  - Header shows the container's name as the page heading, with the kind label (from `container-kind-label.ts`) as a small subtitle/badge next to it — e.g. "Гостиная" (heading) + "Комната" (badge). Root containers (`kind === null`) show no badge.
  - While the container itself is pending, show a `Skeleton` in place of the header (list below has its own independent pending state).
- `index.ts` — barrel exporting `ContainerByIdPage`.

**Modified:**
- `kernel/routes.ts` — `ROUTES.CONTAINER_BY_ID`
- `app/routes/router.tsx` — new child route
- `pages/home/ui/home-page.tsx` — renders `ContainerList` instead of `return null`

## Error Handling

- List query failure → `ErrorMessage` in place of the list, no retry button for v1 (react-query's default retry already applies).
- `ContainerByIdPage`'s own `byId` query failure (e.g. bad/stale id in the URL, container deleted by another session) → `ErrorMessage` in place of the header; the back link still can't be derived without the container data, so in this case fall back to a static "На главную" link to `ROUTES.HOME`.

## Verification

- Gate per task: `npx tsc -b --noEmit` from `fe/`.
- Final: `bun run lint` + `bun run build` green.
- Manual (dev server, seeding containers via Swagger since create-UI doesn't exist yet): create a small tree (root → room → box) directly through the API, then verify: HOME lists the root, clicking it goes to `/containers/$id` and lists the room, clicking the room lists the box, "← Назад" walks back up correctly at each level including from a root container back to HOME.

## Risks

- No backend pagination on `findChildren` — assuming container counts per level stay small (this is a personal home-inventory app, not expected to have hundreds of siblings). If that assumption breaks, this design needs revisiting, but it's not worth building pagination speculatively now.
