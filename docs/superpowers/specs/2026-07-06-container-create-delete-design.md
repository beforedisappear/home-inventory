# Container Create/Delete — Design

**Date:** 2026-07-06
**Scope:** Add create and delete for containers on top of the existing `features/container` (entity: header/name) and `features/container-list` (children listing) slices. No new top-level feature — everything lands inside those two, plus new `services/container-rule` and a small generic event-emitter utility in `shared/lib`.

## Goal

The browsing feature (`container-list-design.md`) is read-only. This adds:
- Creating a container — root (from Home) or child (from any container view), with a kind picker that only shows kinds actually allowed by the parent's nesting rule.
- Deleting a container — from its own header (self-delete) and from each row in a children list (row-delete).

Backend (`ContainerController`, `ContainerRuleController`) already supports both; no API changes needed.

## Non-Goals

- No `ContainerRule` management UI (create/edit rules). Root containers are created without `ruleId` (unrestricted for their future children) — picking/creating a rule is a separate future feature.
- No move/edit UI.
- No parsing of backend error bodies. The 409 "not empty" conflict on delete gets one generic `toast.danger`, matching how every other mutation in this codebase already handles errors (static message, `catch` swallows the real error).
- No optimistic updates — mutations invalidate and let react-query refetch.

## Event Emitter Infra (new — `shared/lib/event-emitter`)

Generic typed pub/sub, framework for decoupling "somewhere on the page, tell the globally-mounted modal to open" without prop drilling or a page-spanning store:

- `event-emitter.ts` — `EventEmitter<Events extends Record<string, unknown>>` class with `on`/`off`/`emit`.
- `types.ts` — `EventListener<T> = (payload: T) => void`.
- `use-event.ts` — `useEvent(emitter, event, callback)` hook: subscribes in `useEffect`, unsubscribes on cleanup/re-render.
- `index.ts` — barrel.

Already implemented and typechecked clean, unused until wired up below.

## Data Layer

**`services/container`** (existing, extend):
- `api/create.ts` — `createContainerRequest(dto: CreateContainerDto)` → `POST /api/v1/containers`.
- `api/delete.ts` — `deleteContainerRequest(id: string)` → `DELETE /api/v1/containers/{id}`.
- `container.queries.ts` — add:
  - `create: () => mutationOptions({ mutationFn: createContainerRequest, onSuccess: (data) => queryClient.invalidateQueries({ queryKey: buildContainerChildrenKey(data.parentId ?? null) }) })`
  - `delete: () => mutationOptions({ mutationFn: (vars: { id: string; parentId: string | null }) => deleteContainerRequest(vars.id), onSuccess: (_data, vars) => { queryClient.invalidateQueries({ queryKey: buildContainerChildrenKey(vars.parentId) }); queryClient.removeQueries({ queryKey: buildContainerByIdKey(vars.id) }); } })`

**`services/container-rule`** (new, mirrors `services/container`):
- `api/find-by-id.ts` — `findContainerRuleByIdRequest(id: string)` → `GET /api/v1/container-rules/{id}`.
- `container-rule.queries.ts` — `containerRuleQueries.byId(id)`.
- `index.ts` — barrel.

**`kernel/container/keys.ts`** (existing file, extend) — add `buildContainerRuleByIdKey(id: string) => ['container-rule', id] as const`. (Kept under `kernel/container` rather than a new `kernel/container-rule` — it's still container-domain cache-keying, no need for a new kernel folder for one key builder.)

## Create Flow

**`features/container/model/create-container-events.ts`**
```ts
import { EventEmitter } from '@/shared/lib/event-emitter';

interface CreateContainerEvents {
  open: { parentId: string | null };
}

export const createContainerEvents = new EventEmitter<CreateContainerEvents>();
```

**`features/container/model/get-allowed-kinds.ts`** — pure function:
```ts
function getAllowedKinds(
  parentKind: ContainerKind | null,
  rule: ContainerRuleResponseDto | null,
): ContainerKind[]
```
- `rule === null` → all 5 kinds (unrestricted, mirrors backend's `assertPlacementAllowed`'s `if (!rule) return`).
- `parentKind === null` (parent is itself root) → kinds whose `canBeInsideRoot` is true.
- otherwise → kinds whose `allowedParents` includes `parentKind`.

**`features/container/model/schemas.ts`** — zod schema for the form: `name` (`min(1)`, `max(128)`, matching backend), `kind` optional string.

**`features/container/model/use-create-container-form.ts`**:
- If `parentId` is set: `useQuery(containerQueries.byId(parentId))` for parent kind/ruleId, and — only when parent has a `ruleId` — `useQuery(containerRuleQueries.byId(parent.ruleId))`. Computes `allowedKinds` via `getAllowedKinds`.
- `useMutation(containerQueries.create())`.
- `useForm` (tanstack/react-form + zod, matching `use-user-profile-form.ts` style): submits `{ name, parentId: parentId ?? undefined, kind: parentId ? kind : undefined }`. On success: `toast.success('Контейнер создан')` + `onSuccess()` callback (closes modal). On error: `toast.danger('Не удалось создать контейнер')`.
- Exposes whether `allowedKinds` is empty (parent is a dead-end, e.g. default rule's `bag`) so the form can disable submit and show a message instead of the select.

**`features/container/ui/create-container-form.tsx`** — `FormTextField` for name; `Select` (added to `shared/ui` barrel) for kind, only rendered when `parentId` is set, options = `allowedKinds` mapped through `getContainerKindLabel`.

**`features/container/ui/create-container-modal.tsx`** — mounted once in `ProtectedLayout` (alongside `<Header />`), not per-page:
```tsx
const [parentId, setParentId] = useState<string | null>(null);
const state = useOverlayState();

useEvent(createContainerEvents, 'open', ({ parentId }) => {
  setParentId(parentId);
  state.open();
});
```
Renders `Modal.Root` (state) → `CreateContainerForm` with `parentId` + `onSuccess={state.close}`.

**`features/container/ui/create-container-trigger.tsx`** — small FAB button:
```tsx
<Button isIconOnly className='fixed bottom-6 right-6 size-14 rounded-full shadow-lg'
  onPress={() => createContainerEvents.emit('open', { parentId })}>
  <Plus size={24} />
</Button>
```
Rendered directly by `HomePage` (`parentId={null}`) and `ContainerByIdPage` (`parentId={id}`), next to the existing `ContainerHeader`/`ContainerList` composition.

**`features/container/index.ts`** — barrel also exports `CreateContainerModal`, `CreateContainerTrigger`.

**`app/layouts/protected-layout.tsx`** — add `<CreateContainerModal />` once, next to `<Header />`.

## Delete Flow

No shared component — each site's post-success behavior differs, so each is written directly where it's used (small, ~15-20 lines each):

- **`features/container/ui/container-header.tsx`** — `AlertDialog` (danger status) next to the name/kind row: "Удалить «{name}»?". On confirm: `useMutation(containerQueries.delete())` with `{ id: container.id, parentId: container.parentId }`. On success: `navigate({ to: container.parentId ? ROUTES.CONTAINER_BY_ID : ROUTES.HOME, params: ... })`. On error (409 or otherwise): `toast.danger('Контейнер не пуст — уберите вложенные контейнеры и вещи, чтобы удалить')`.
- **`features/container-list/ui/container-list.tsx`** — same `AlertDialog` + mutation per row, `{ id: child.id, parentId }` (the list's own `parentId` prop — that's the row's parent). On success: nothing extra needed, cache invalidation already removes the row. Same error toast as above.

## Error Handling

- Create: generic `toast.danger('Не удалось создать контейнер')` on any failure (400 kind/rule violations included — the smart kind select should make these rare, but the form doesn't special-case them).
- Delete: generic `toast.danger('Контейнер не пуст — уберите вложенные контейнеры и вещи, чтобы удалить')` covers both 409 causes (child containers or items) in one message, since both amount to the same corrective action.

## Verification

- Gate per task: `npx tsc -b --noEmit` from `fe/`.
- Final: `bun run lint` + manual walkthrough — create a root container from Home, drill in, create children of a couple kinds (verify the kind select narrows correctly per the default rule's cascade room→cabinet→drawer→box/bag), delete a leaf child from the list, delete a container via its own header and confirm navigation lands on the parent/Home, attempt to delete a non-empty container and confirm the conflict toast.

## Risks

- `getAllowedKinds` duplicates the backend's `assertPlacementAllowed` filtering logic on the frontend (for UX only — backend remains the source of truth and still validates on submit). If the default rule's cascade ever changes shape, both sides need updating; acceptable for now since there's only one seeded rule.
