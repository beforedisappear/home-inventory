# Items (Base CRUD) — Design

## Goal

Add a frontend feature for managing Items (things stored inside a Container). Backend is fully built (CRUD, category filter, QR, custom fields, documents, notifications, reports); this feature covers only the foundational slice: Create, List, Edit, Delete for an item's core fields, displayed inside the container it belongs to.

## Context

Containers already have a working list/create/edit/delete UI (`features/container-list`, `container-create`, `container-edit`, `container-delete`), wired into `ContainerByIdPage` via a shared `actions` render-prop and a `renderItemActions` render-prop on `ContainerList`. Items reuse these same architectural patterns rather than inventing new ones.

Category has a fully built backend module (`GET/POST/PATCH/DELETE /api/v1/categories`) but no frontend UI yet. This feature only needs read access to the category list (for a select field), not full category CRUD.

## Scope

**In scope — full CRUD for Item's basic fields:**
- `name` (required, 1–256 chars)
- `categoryId` (optional, selected from existing categories via a minimal read-only select)
- `quantity` (optional int ≥ 1, default 1)
- `description` (optional, up to 2048 chars)
- List items inside a container, alongside sub-containers, in one unified list
- Create, edit, delete a single item

**Out of scope (future features):**
- Photos, QR codes, custom fields, document attachments, warranty notifications, reports — all already built on the backend, none wired to frontend here
- Category CRUD UI (create/edit/delete categories) — only a read-only list is consumed
- Search (`q`) and category filter on the item list
- An item detail page (items are only ever shown/edited/deleted as rows in a container's list)

## Architecture

### Unified list via children composition

`ContainerList` (`features/container-list/ui/container-list.tsx`) gains a `children?: ReactNode` prop, rendered as the last node inside its existing `<ul>`, after the mapped container rows. Its empty-state condition changes from `data.length === 0` to `data.length === 0 && !children`, so that a container with zero sub-containers but non-zero items doesn't get swallowed by ContainerList's own "Здесь пусто" message.

Trade-off accepted: if a container has zero sub-containers **and** zero items, no explicit empty message renders (blank space instead). This is a minor cosmetic gap, deferred — fixing it would require cross-list empty-state coordination that isn't worth the complexity for a first pass.

`ItemList` (new, `features/item-list`) is a rows-only component — no own `<ul>`, no own top-level loading/error/empty block. It fetches its own data (`itemQueries.byContainer(containerId)` and `categoryQueries.list()` to resolve category names for display) and renders one `<li>` per item. It's passed as `children` to `ContainerList`, so its `<li>` rows land inside the same `<ul>` as container rows.

`CreateItem` (new, `features/item-create`) renders as a trailing `<li>` styled as a dashed "+ Добавить вещь" row — also passed as a `ContainerList` child, after `ItemList`. This matches the user's choice of a separate in-list row (not a header action) for triggering item creation.

Page-level composition (`ContainerByIdPage`):
```tsx
<ContainerList parentId={id} renderItemActions={...}>
  <ItemList
    containerId={id}
    renderItemActions={item => (
      <>
        <ItemEdit item={item} containerId={id} />
        <ItemDeleteTrigger itemId={item.id} containerId={id} itemName={item.name} />
      </>
    )}
  />
  <CreateItem containerId={id} />
</ContainerList>
```

### Edit/Delete: self-contained pattern, not emitter

`ContainerDeleteTrigger` uses an emitter + shared dialog because it's invoked from two places (self-delete in the container header, and per-row delete in the children list) that need to share one dialog instance. Items have no such second call site yet — no item detail page exists, so delete is only ever triggered from the row. Following the same reasoning that shaped `ContainerEdit` (self-contained: owns its own `useOverlayState()`, renders trigger + modal + form together), both `ItemEdit` and `ItemDeleteTrigger` are self-contained components with no emitter.

If an item detail page is added later with its own self-delete action, `ItemDeleteTrigger` can be migrated to the emitter pattern then — not before.

### Slices

- `services/category` — read-only: `findAllCategoriesRequest` (`GET /api/v1/categories`), `categoryQueries.list()`
- `services/item` — `findItemsByContainerRequest` (`GET /api/v1/items?containerId=...`), `createItemRequest`, `updateItemRequest`, `deleteItemRequest`, grouped in `itemQueries` (`byContainer`, `create`, `update`, `delete`)
- `kernel/item/keys.ts` — `buildItemsByContainerKey(containerId)`
- `features/item-list` — `ItemList` (rows-only, as described above)
- `features/item-create` — `CreateItem` (self-contained: dashed row + modal + form)
- `features/item-edit` — `ItemEdit` (self-contained: pencil icon + modal + form), mirrors `ContainerEdit` shape exactly
- `features/item-delete` — `ItemDeleteTrigger` (self-contained: trash icon + inline `AlertDialog`, no emitter)
- Modified: `features/container-list/ui/container-list.tsx` (`children` prop + empty-state condition)
- Modified: `shared/ui/form-text-field.tsx` (`type` union gains `'number'`, needed for `quantity`)
- New: `shared/ui/form-textarea-field.tsx` — `FormTextareaField`, mirrors `FormTextField` but wraps HeroUI's `Textarea`, needed for `description`

## Data Layer

Types come from the existing generated schema (`@/kernel/api/schema`) — `ItemResponseDto`, `CreateItemDto`, `UpdateItemDto`, `CategoryResponseDto` already exist there; no regeneration needed.

```ts
// kernel/item/keys.ts
export const buildItemsByContainerKey = (containerId: string) =>
  ['items', 'by-container', containerId] as const;
```

```ts
// services/item/api/find-by-container.ts
GET /api/v1/items, params: { query: { containerId } } -> ItemResponseDto[]

// services/item/api/create.ts
POST /api/v1/items, body: CreateItemDto -> ItemResponseDto

// services/item/api/update.ts
PATCH /api/v1/items/{id}, body: UpdateItemDto -> ItemResponseDto

// services/item/api/delete.ts
DELETE /api/v1/items/{id} -> void
```

```ts
// services/item/api/item.queries.ts
itemQueries.byContainer(containerId) // queryOptions, queryKey: buildItemsByContainerKey(containerId)
itemQueries.create()  // mutationOptions, invalidates buildItemsByContainerKey(vars.containerId) on success
itemQueries.update()  // vars: { id, containerId, ...UpdateItemDto fields }, invalidates buildItemsByContainerKey(vars.containerId)
itemQueries.delete()  // vars: { id, containerId }, invalidates buildItemsByContainerKey(vars.containerId)
```

```ts
// services/category/api/find-all.ts
GET /api/v1/categories -> CategoryResponseDto[]

// services/category/api/category.queries.ts
categoryQueries.list() // queryOptions, queryKey: ['categories'], no invalidation needed (read-only in this feature)
```

## Component Responsibilities

- **`ItemList`**: `useQuery(itemQueries.byContainer(containerId))` + `useQuery(categoryQueries.list())`. Pending → renders nothing extra (ContainerList's own spinner already covers perceived loading; avoids a jarring second spinner). Error → a single small inline `<li>` with retry text. Per item: icon (`Box` from lucide), name (truncate), quantity badge (`× N`, shown only when `quantity !== 1`), category badge (resolved name from the categories list, shown only when `categoryId` is set and found), and the `renderItemActions?.(item)` slot on the right — same shape as `ContainerList`'s existing prop.
- **`CreateItem`**: self-contained (`useOverlayState`), dashed `<li>` button "+ Добавить вещь", opens modal with the create form. On success, invalidates the container's item list (handled by the mutation itself) and closes.
- **`ItemEdit`**: self-contained, pencil icon button per row, opens modal pre-filled with the item's current values, submits via `itemQueries.update()`.
- **`ItemDeleteTrigger`**: self-contained, trash icon button per row, opens an inline `AlertDialog` (own state, not shared), confirms via `itemQueries.delete()`.
- **Category select** (used in both create and edit forms): HeroUI `Select.Root/Trigger/Popover` + `ListBox`, mirroring the `kind` select in `create-container-form.tsx`. Includes a "Без категории" option mapped to `categoryId: undefined` on submit.

## Backend Fix Required

`UpdateItemDto.categoryId` is currently `string` (not `string | null`), and `ItemService.update` only touches `categoryId` when the incoming value is truthy — there is no way to explicitly clear a category via the API today, only to set/change it. Since the edit form's "Без категории" option needs to actually clear an existing category, `UpdateItemDto.categoryId` is widened to `string | null` (small, scoped fix — no service/repository change needed, since both already propagate an explicit `null` correctly once the DTO allows it). The frontend OpenAPI schema is regenerated after this change.

## Error Handling

Consistent with existing container mutations: `toast.danger('...')` on failed create/update/delete, `toast.success('...')` on success. No special-cased error states beyond the existing `ErrorState`/toast conventions already used across the app.

## Testing / Verification

Per project convention (no unit-test runner on the frontend): `bun run build` (catches type errors via `tsc -b`) + `bun run lint`, plus one manual browser walkthrough covering create → edit → delete of an item inside a container, and confirming sub-containers and items render correctly in the same list.
