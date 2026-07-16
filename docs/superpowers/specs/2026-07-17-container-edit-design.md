# Container Edit (Rename) — Design Spec

**Date:** 2026-07-17

## Goal

Let a user rename a container. Backend already supports this fully
(`PATCH /api/v1/containers/:id` accepts `{ name? }`, no other validation
beyond length) — this is a frontend-only feature.

## Context

Containers currently have no edit capability at all. This gap was noticed
while brainstorming the next feature (Items) — Items' create/edit scope
decision surfaced the fact that containers themselves can't be renamed yet.
Decided to build Container Edit first, as its own small feature, before
returning to Items.

## Scope

- Rename a container's `name` field only. `kind` is immutable after
  creation; root `ruleId` has no update path on the backend and is out of
  scope here.
- Trigger lives only in the container's own header (self-rename), mirroring
  where self-delete lives today. Per-row rename from a children list (the
  way per-row delete exists in `ContainerList`) is explicitly deferred — no
  known need for it yet, easy to add later following the same emitter
  pattern `container-delete` uses if it comes up.

## Architecture

New feature slice: `features/container-edit`. Kept as its own slice (not
colocated inside `features/container`) for structural consistency with
`container-create` / `container-delete` — this repo's established
convention is one feature per CRUD operation on `container`.

Unlike `container-delete`, this feature does **not** need an event emitter
or a page-level shared dialog. Delete needs that because it's triggered
from multiple places (header self-delete + per-row list delete) sharing one
confirmation dialog. Rename has exactly one trigger point, so
`ContainerEditTrigger` owns its own overlay state directly and renders its
modal inline — the same self-contained shape as
`features/user-profile/ui/user-email-change.tsx`.

**Files:**
- `features/container-edit/index.ts` — public export: `ContainerEditTrigger`
- `features/container-edit/model/schemas.ts` — zod schema for `name`
  (`min(1)`, `max(128)`, matching backend `UpdateContainerDto` /
  `create-container`'s existing name rule)
- `features/container-edit/model/use-container-edit-form.ts` — TanStack
  form: `defaultValues.name` = current name (passed in as a prop, no async
  load needed — the container is already loaded by the time the trigger
  renders), `onSubmit` calls the new `update()` mutation, toasts
  success/failure, calls `onSuccess` (closes the modal) on success
- `features/container-edit/ui/container-edit-form.tsx` — `AdaptiveModal.Body`
  (name field) + `AdaptiveModal.Footer` (Отмена / Сохранить), structurally
  mirrors `user-email-change-form.tsx`
- `features/container-edit/ui/container-edit-modal.tsx` — `AdaptiveModal`
  wrapper, heading "Переименовать контейнер"
- `features/container-edit/ui/container-edit-trigger.tsx` — icon button
  (pencil, `isIconOnly`), owns `useOverlayState()`, renders itself + the
  modal + the form

**Wiring:** `ContainerByIdPage` already has an `actions` render-prop on
`ContainerHeader` that supplies `CreateContainer` and
`ContainerDeleteTrigger`. Add `ContainerEditTrigger` there:

```tsx
<ContainerEditTrigger
  containerId={container.id}
  parentId={container.parentId}
  name={container.name}
/>
```

No changes to `ContainerHeader` itself — it already forwards `actions`
verbatim.

## Data layer

Add to `services/container`:
- `api/update.ts` — `updateContainerRequest(id, dto)`, `PATCH
  /api/v1/containers/{id}`
- `containerQueries.update()` mutation, mirroring the shape of `create()`
  and `delete()`:

```ts
update: () =>
  mutationOptions({
    mutationFn: (vars: { id: string; parentId: string | null; name: string }) =>
      updateContainerRequest(vars.id, { name: vars.name }),
    onSuccess: (_data, vars) => {
      queryClient.invalidateQueries({ queryKey: buildContainerByIdKey(vars.id) });
      queryClient.invalidateQueries({
        queryKey: buildContainerChildrenKey(vars.parentId),
      });
    },
  }),
```

Both invalidations are needed: `byId` refreshes the header's own name;
`children(parentId)` refreshes the row for this container in its parent's
list (`ContainerList`), which reads the name from the parent's children
query.

## Error handling

Same shape as every other mutation in this codebase: `try/await/catch`
around `mutateAsync`, `toast.danger(...)` on failure, no special-casing —
the only backend validation is name length, already enforced client-side by
the zod schema before submit.

## Testing / verification

- Typecheck + lint clean.
- One manual pass: open a non-root container, rename it, confirm the header
  updates and the name change is reflected when navigating back to the
  parent's list.
- No new backend work, so no backend tests needed.

## Out of scope (explicitly deferred)

- Per-row rename from `ContainerList` (only self-rename via header for now)
- Editing `kind` or root `ruleId`
- Items feature (paused to do this first; resumes after)
