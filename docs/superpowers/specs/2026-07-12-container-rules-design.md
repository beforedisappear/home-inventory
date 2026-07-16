# Container Rules Mechanism — Design Spec

## Problem

The backend already has a full `ContainerRule` model: a named, reusable set of
`kindRules` (per container `kind`: can it sit directly in root, and which
parent `kind`s can it be placed inside). A system default rule ("Стандарт",
strict cascading hierarchy room → cabinet → drawer → box/bag) is seeded on
boot. Root containers can optionally be created with a `ruleId`, and children
inherit their parent's `ruleId` automatically.

The frontend never wires this up. `CreateContainerForm` never lets the user
pick a `ruleId` when creating a root container, so every root container today
ends up with `ruleId: null` (no rule, no restriction). As a result the whole
rules mechanism — including the seeded "Стандарт" rule — is inert: nothing in
the running app ever assigns a rule to anything.

## Goal

Let the user pick a rule when creating a root container, and let them create
their own custom rule inline if the existing ones don't fit. Out of scope for
this iteration: a dedicated rules-management page, editing/deleting rules,
and retroactively assigning a rule to an already-created root container (the
backend's `UpdateContainerDto` only supports renaming — adding `ruleId`
mutability there is a separate, later change if ever needed).

## Backend change

`ContainerRuleResponseDto` doesn't expose whether a rule is the system
default (`ownerId === null` never leaves the mapper). The frontend needs this
to preselect "Стандарт" by default without relying on matching the display
name (fragile — breaks on rename/localization).

- `ContainerRuleResponseDto` gains `isSystem: boolean`.
- `ContainerRuleMapper.toResponseDto` sets it from `doc.ownerId === null`.

No other backend changes. `GET /container-rules` (list, system + own),
`GET /container-rules/:id`, and `POST /container-rules` already cover
everything the frontend needs.

## Frontend architecture

Rules are a standalone domain concept, not a `container-create` implementation
detail — a new feature slice keeps it that way and matches the project's
layering rule (features may not import each other; composition happens at
the `pages` layer via render-prop slots, same pattern already used by
`ContainerList`'s `renderItemActions` and `ContainerHeader`'s `actions`).

```
services/container-rule/          (data access — extended)
  api/find-all.ts                 NEW — GET /container-rules
  api/find-by-id.ts                    (existing, unchanged)
  api/create.ts                   NEW — POST /container-rules
  api/container-rule.queries.ts   extended: list(), create() alongside byId()

features/container-rule/          (NEW feature slice)
  ui/container-rule-field.tsx     public. Owns its own local "select vs.
                                   create" mode; consumer just gets
                                   { value, onChange }.
  ui/rule-select.tsx              internal. Dropdown: "Стандарт" (default),
                                   user's own rules, "Без правила", and a
                                   "+ Создать своё правило" action item that
                                   flips the parent's internal mode.
  ui/create-rule-form.tsx         internal. Name + 5-row kind matrix. Own
                                   submit button (type="button" + onClick,
                                   not a nested <form> — it renders inside
                                   the outer container-create <form>).
  model/use-create-rule-form.ts   tanstack-form + create mutation for the
                                   matrix form.
  index.ts                        exports ONLY ContainerRuleField.

features/container-create/
  ui/create-container-form.tsx    gains an optional
                                   `renderRuleField?: (props: {
                                     value: string;
                                     onChange: (ruleId: string) => void;
                                   }) => ReactNode`
                                   prop, rendered in the root-container
                                   branch (parentId === null) in place of
                                   nothing today. The component has no
                                   knowledge of rules beyond this slot.
  ui/create-container.tsx         forwards `renderRuleField` through to
                                   CreateContainerForm.
  model/use-create-container-form.ts
                                   defaultValues gains `ruleId: ''`; on
                                   submit for root containers, passes
                                   `ruleId: value.ruleId || undefined`.

pages/home/ui/home-page.tsx       the only root-creation call site
                                   (`<CreateContainer parentId={null} />`).
                                   Wires the slot:
                                   `renderRuleField={props => <ContainerRuleField {...props} />}`.
                                   container-by-id-page.tsx's CreateContainer
                                   call always creates children (parentId =
                                   current container's id), so it needs no
                                   slot.
```

## Behavior

1. Opening "Создать контейнер" at the root level shows the existing "Название"
   field plus `ContainerRuleField`, defaulting to whichever rule has
   `isSystem: true` ("Стандарт") once the rules list loads.
2. Picking a different existing rule, or "Без правила", just updates the
   form's `ruleId` value — no extra request.
3. Picking "+ Создать своё правило" swaps `ContainerRuleField`'s own render
   from the select to the create-rule form (matrix builder). The rest of the
   modal — "Название" input, its current value — is untouched; nothing
   remounts.
4. Submitting the create-rule form POSTs the new rule, then
   `ContainerRuleField` switches itself back to select mode with the new
   rule's id passed up via `onChange`, so it becomes the selected value on
   the outer container form. "Отмена" inside the matrix form just switches
   back to select mode without creating anything.
5. Submitting "Создать" on the outer form creates the root container with
   the selected `ruleId` (or omits it for "Без правила").
6. Child-container creation is unaffected — kind narrowing via
   `getAllowedKinds` already works off the parent's inherited `ruleId`, this
   feature only adds the missing piece that lets a `ruleId` exist in the
   first place.

## Validation & error handling

- Rule name: required, 1–128 chars (mirrors `CreateContainerRuleDto`).
  Duplicate name → backend 409 (`ConflictException`) → toast, e.g. «Правило с
  именем «X» уже существует».
- At least one kind must be included in the matrix before submit (backend:
  `ArrayMinSize(1)` on `kindRules`) — mirrored client-side so the submit
  button stays disabled until satisfied, consistent with how
  `CreateContainerForm` already disables its submit button.
- A kind row with neither "можно в root" checked nor any allowed parent
  selected is a dead rule (that kind could never be created under this
  rule). Not blocked server-side, but the client warns/disables submit for
  that row to avoid a silently unusable rule — same "UX-only guard, backend
  still the source of truth" pattern already used by `getAllowedKinds`.

## Out of scope (explicit)

- Dedicated `/rules` management page.
- Editing or deleting existing rules.
- Reassigning `ruleId` on an already-created root container.
