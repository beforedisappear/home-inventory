# Item Detail Page (Foundation) — Design

## Goal

Add a dedicated `/items/$id` page as the canonical place for viewing and editing a single item. This replaces list-row-triggered modal editing with page-header-triggered modal editing, and is the foundation sub-project onto which Photos and Custom Fields sections will be added later as their own features.

## Context

The base Items CRUD feature just shipped (`docs/superpowers/specs/2026-07-17-items-design.md`): create via a dashed row + modal, list rows show edit(pencil)+delete(trash) icons, both self-contained (own overlay/dialog state), no navigation involved. The backend already exposes `GET /items/:id` (already present in the generated frontend schema as operation `ItemController_findById_v1`), and `ItemResponseDto` already includes `containerId`, `photos`, and `customFields` (the latter two unused by the frontend so far). No backend changes are needed for this sub-project.

This is sub-project #1 of 3 for extending Items beyond base CRUD, decomposed because photos and custom fields are independent subsystems that don't fit in the current 4-field modal:
1. **Item Detail Page (this spec)** — page shell, navigation, migrate edit/delete trigger location
2. Photos section (future spec) — upload, gallery, delete, reorder
3. Custom fields section (future spec) — typed key-value editor

## Scope

**In scope:**
- New route `/items/$id` → `ItemByIdPage`
- New query `itemQueries.byId(id)` backed by the existing `GET /items/:id` endpoint
- Page shell: back-to-container link, item name as heading, edit + delete actions in the header, reusing the existing `ItemEdit` and `ItemDeleteTrigger` components unchanged in shape (only `ItemDeleteTrigger` gains one new optional prop)
- Page body: read-only display of category (resolved name as a chip), quantity, description
- `ItemList` row: name/icon becomes a `Link` to the detail page; **the edit (pencil) action is removed from the list row** — editing is only reachable from the detail page header now. Delete (trash) stays in the row as a quick action.
- `ItemDeleteTrigger` gains an optional `onDeleted?: () => void` prop (mirroring `ContainerDeleteTrigger`), used by the detail page to navigate back to the parent container after a successful self-delete. The list-row usage doesn't pass it — behavior there is unchanged.
- `itemQueries.update()`'s `onSuccess` additionally invalidates the item's `byId` query key (not just `byContainer`), so editing from the detail page's modal refreshes the page without a manual reload.

**Out of scope (future sub-projects):**
- Photos section (upload/gallery/reorder/delete)
- Custom fields section (typed key-value editor)
- Any inline/on-page field editing — editing stays modal-based, only its trigger location moves
- Any backend changes — `GET /items/:id` already exists and already covers everything this page needs

## Architecture

### Why no emitter migration for `ItemDeleteTrigger`

Earlier discussion floated migrating `ItemDeleteTrigger` to the emitter + shared-dialog pattern (`ContainerDeleteTrigger`'s pattern) once a second call site appeared. On closer look this isn't needed: `ContainerDeleteTrigger` uses an emitter because self-delete (in `ContainerHeader`) and per-child-row delete (in `ContainerList`) render **on the same page simultaneously** (`ContainerByIdPage`) — the emitter avoids mounting N+1 separate dialog trees on one page. For items, self-delete lives on `ItemByIdPage` and per-row delete lives on `ContainerByIdPage`'s item list — two different pages that are never rendered at the same time. There's no multi-instance-per-page problem to solve, so `ItemDeleteTrigger` stays self-contained and is simply reused as-is (plus the new `onDeleted` prop) on the detail page.

### No separate `ItemHeader` abstraction

`ContainerHeader` exists as its own component because `ContainerByIdPage` composes it with a list of children below it on the same page (self-header + child list). Items have no analogous nested list under their own detail page, so `ItemByIdPage` does its own fetch and renders its header inline — introducing a separate `ItemHeader` component would be an abstraction with only one caller.

### Routing

- `kernel/routes.ts` gains `ITEM_BY_ID: '/items/$id'`
- `app/routes/router.tsx` gains an `itemByIdRoute` registered as a child of `protectedRoute`, mirroring `containerByIdRoute` exactly (same `getParentRoute`, same shape, different `path`/`component`)
- `pages/item-by-id/ui/item-by-id-page.tsx` + `pages/item-by-id/index.ts` barrel, mirroring `pages/container-by-id`'s structure

### List row change

`ItemList`'s per-item `<li>`: the name/icon `<span>` becomes a `<Link to={ROUTES.ITEM_BY_ID} params={{ id: item.id }}>` wrapping the icon+name+badges (mirrors `ContainerList`'s child-row `Link` exactly — icon and name become the clickable link, action buttons stay outside it). The `renderItemActions` slot passed from `ContainerByIdPage` drops the `<ItemEdit .../>` element and keeps only `<ItemDeleteTrigger .../>`.

### Detail page

`ItemByIdPage`:
1. Reads `id` from route params
2. `useQuery(itemQueries.byId(id))` — pending → `Spinner`; error → `ErrorState` with retry (same conventions as `ContainerList`)
3. On success, renders:
   - A back link to `ROUTES.CONTAINER_BY_ID` with `params: { id: item.containerId }` (label "Назад к контейнеру", mirroring the "На главную" back-link style used elsewhere)
   - Heading: `item.name`
   - Header actions: `<ItemEdit item={item} containerId={item.containerId} />` and `<ItemDeleteTrigger itemId={item.id} containerId={item.containerId} itemName={item.name} onDeleted={handleNavigateToContainer} />`, where `handleNavigateToContainer` calls `navigate({ to: ROUTES.CONTAINER_BY_ID, params: { id: item.containerId } })`
   - Body: category chip (resolved via `categoryQueries.list()`, same lookup pattern already used in `ItemList`), quantity ("Количество: N"), description (muted text, or nothing if empty)

## Data Layer

```ts
// kernel/item/keys.ts — add:
export const buildItemByIdKey = (id: string) => ['items', 'by-id', id] as const;
```

```ts
// services/item/api/find-by-id.ts
GET /items/{id} -> ItemResponseDto
```

```ts
// services/item/api/item.queries.ts — add:
itemQueries.byId(id) // queryOptions, queryKey: buildItemByIdKey(id)

// modify itemQueries.update()'s onSuccess to also invalidate buildItemByIdKey(vars.id)
```

## Component Responsibilities

- **`ItemByIdPage`**: fetches the item by id, handles pending/error/success states directly (no intermediate header component), renders back-link + heading + actions + read-only field display.
- **`ItemEdit`**: unchanged — reused as-is, now triggered from the detail page header instead of (in addition to) the list row.
- **`ItemDeleteTrigger`**: gains `onDeleted?: () => void`, called after a successful delete in addition to the existing `state.close()`. List-row usage passes nothing (unchanged behavior — list just re-renders via query invalidation). Detail-page usage passes a navigate-to-container callback.
- **`ItemList`**: row's name/icon becomes a navigation `Link`; `renderItemActions` usage in `ContainerByIdPage` drops the edit trigger, keeps delete.

## Error Handling

Same conventions as the rest of the app: `ErrorState` + retry for the item fetch failure; existing toast conventions (`toast.success`/`toast.danger`) for edit/delete mutations, unchanged.

## Testing / Verification

Per project convention: `bun run build` + `bun run lint` on the frontend (no backend changes in this sub-project), plus one manual walkthrough — navigate from an item's list row to its detail page, confirm the back link returns to the correct container, edit the item from the header (confirm the list row no longer shows a pencil), delete the item from the header (confirm navigation back to the container and the item is gone from the list).
