# Item & Container QR Codes — Design

## Goal

Let a user generate, view, and download a QR code for an item or for a non-root container, from that entity's detail page. Scanning the code later should identify which item/container it is.

## Context

Item already had a working QR pipeline (schema fields, service, BullMQ processor, controller endpoints, frontend hook + UI) from an earlier sub-project. Containers had none. The root container (the one with no `kind`, `parentId === null`) is a bare organizational node — QR is only meaningful for the containers a user actually places inside their home (`kind` set), so root containers are explicitly excluded.

## Scope

**In scope:**

- Container gains the same QR capability Item already has: `qrStatus`/`qrKey` on the schema, `GET /api/v1/containers/:id/qr`, `POST /api/v1/containers/:id/qr/generate`, a 400 guard on root containers.
- Frontend: a shared `features/qr` slice (`useQr` hook + `QrTrigger`/`QrModal` for detail-page headers + `QrButton` for list rows) usable by both Item and Container without a cross-feature import between `features/item` and `features/container`.
- QR generation is async: `generate` enqueues a BullMQ job and immediately returns `status: 'pending'`; the job renders an SVG, uploads it to S3, and flips status to `ready` (or `failed` once retries are exhausted).

**Out of scope:**

- QR for the root container.
- Any change to the QR payload format itself (`i:<id>` / `c:<id>`, scanned by a future/external reader — not built here).

## Architecture

### Backend: duplicated per-entity, not a shared module

The first implementation attempt shared one `QrService`/`QrGenerateProcessor`/`QrModule` between Item and Container, parameterized by `entityType`. That required `QrModule` to import both `ItemModule` and `ContainerModule` (to reach their repositories), which in turn had to import `QrModule` back — a 3-way circular dependency resolved with `forwardRef`. Functionally this worked and booted cleanly, but on review it added a real module (plus, in one iteration, a DI-token indirection) purely to avoid two small, near-identical files. Item and Container's QR logic never actually needs to know about each other.

The shipped design instead duplicates the logic once per entity, each fully contained in its own domain module — no new cross-module dependency at all:

- `api/item/constants/item-qr.ts`, `item-qr-queue.ts`
- `api/item/services/item-qr.service.ts`, `api/item/processors/item-qr-generate.processor.ts`
- `api/container/constants/container-qr.ts`, `container-qr-queue.ts`
- `api/container/services/container-qr.service.ts`, `api/container/processors/container-qr-generate.processor.ts`

Each service is injected with only its own repository (`ItemRepository`/`ContainerRepository`) and registers its own BullMQ queue (`item-qr` / `container-qr`) and bull-board panel. `ItemService`/`ContainerService` call `enqueueGenerate(id, ownerId)` / `deleteIfExists(qrKey)` on their own entity's QR service — same shape both sides, zero coupling between the two modules. Storage keys are namespaced per entity type (`users/{ownerId}/qr/item/{id}.svg`, `users/{ownerId}/qr/container/{id}.svg`) so the two queues never collide on the same S3 key space.

### Frontend: header icon + modal, not an inline card

The first frontend pass rendered a QR block (generate button / image) inline on the page, below the entity's header. For Item this read fine, but for Container it meant either always mounting the block and hiding it for root containers, or threading a `qrSlot` prop into the generic `ContainerHeader` so it could decide when to show it — in both cases a layout-sized chunk of the page was dedicated to a feature most visits don't need.

Shipped instead: `QrTrigger`, a small icon button (`shared/ui/Button`, icon-only) that sits among the other header actions (edit / add / delete), opening an `AdaptiveModal` (`QrModal`) containing the same generate/pending/ready/failed states. This mirrors the existing `ContainerEdit`/`ContainerDeleteTrigger` convention (self-contained trigger + modal) already used for every other header action, rather than introducing a one-off pattern for QR.

- **Item**: `features/item/ui/item.tsx` gains a `headerActions?: ReactNode` prop (same idea as its existing `categorySlot` prop), rendered next to `ItemDeleteTrigger`. The page passes `<QrTrigger entityType='item' entityId={id} />`.
- **Container**: no new prop needed — `ContainerHeader`'s existing `actions={container => ...}` render-prop already receives the loaded container, so the page adds `{container.kind && <QrTrigger .../>}` directly into that render-prop's returned list, alongside `ContainerEdit`/`CreateContainer`/`ContainerDeleteTrigger`. The root-container gate lives at the same call site as the other container-specific actions, not smuggled into the header component itself.

List rows (child containers, items) keep the existing compact `QrButton` — a bare icon that generates/downloads inline without opening a modal, appropriate for a row that's already small.

## Error Handling

`enqueueGenerate` throws `ConflictException` (409) if a generation is already `pending` (atomic `findOneAndUpdate` guard in the repository). The BullMQ processor sets `qrStatus: 'failed'` only once retries are exhausted (`job.attemptsMade >= job.opts.attempts`), not on every transient failure. Frontend surfaces `failed` via the existing `ErrorState`/`toast.danger` conventions, with a retry that re-triggers `handleGenerate`.

## Testing / Verification

No automated test runner in this project. Backend: `nest build` (type-check), a live `start:dev` boot check (DI wiring errors only surface at runtime, not at build time), and a curl smoke test of the full generate → pending → ready → delete cycle for both entity types, plus the root-container 400 guard. Frontend: `bun run build` + `bun run lint`, plus a manual browser walkthrough confirming the QR icon appears only on non-root containers and on items, the modal opens/generates/shows the image, and download works.
