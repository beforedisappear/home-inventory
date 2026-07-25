# Item & Container QR Codes Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Give non-root containers the same QR capability items already have (generate/view/download from the detail page), via a frontend `features/qr` slice shared between both entities.

**Architecture:** Backend: Container gets its own `qrStatus`/`qrKey` schema fields, `ContainerQrService`/`ContainerQrGenerateProcessor` (BullMQ queue `container-qr`), and `GET`/`POST /api/v1/containers/:id/qr[/generate]` endpoints, guarded against root containers (400). This mirrors Item's existing `ItemQrService`/`item-qr` queue exactly — each entity owns its QR logic standalone, no shared module and no cross-module dependency between `api/item` and `api/container` for QR. Frontend: a new `features/qr` slice (`useQr` hook, `QrTrigger` + `QrModal` for detail-page headers, `QrButton` for list rows) composed at the pages layer into both `ItemByIdPage` and `ContainerByIdPage` — no cross-import between `features/item` and `features/container`.

**Tech Stack:** NestJS + Mongoose + BullMQ + S3-compatible storage (backend, mirrors Item's existing QR stack) — React + TanStack Query + HeroUI `AdaptiveModal` (frontend).

## Global Constraints

- Backend commands run from `be/`: `nest build`, `bun run lint`. No automated test runner — verification is build + a live `start:dev` boot check + a curl smoke test.
- Frontend commands run from `fe/`: `bun run build`, `bun run lint`. No automated test runner — verification is build + lint + a manual browser walkthrough.
- Frontend types come from `@/kernel/api/schema`, regenerated via `bun run api:sync` after backend endpoints exist.
- User-facing copy is in Russian, matching every existing feature.
- No `git commit` without a fresh, explicit per-turn user request; project works directly on `main`, no worktrees/feature branches.
- Root containers (`kind === null`) never get QR — every container-side QR entry point (service methods, controller endpoints, frontend trigger) must gate on `container.kind`.
- Storage keys are namespaced per entity type (`users/{ownerId}/qr/item/{id}.svg`, `.../qr/container/{id}.svg`) so Item's and Container's queues never collide on the same S3 key.

---

### Task 1: Container QR schema + repository methods

**Files:**
- Modify: `be/src/api/container/schemas/container.schema.ts`
- Modify: `be/src/api/container/repositories/container.repository.ts`
- Create: `be/src/api/container/interfaces/qr.types.ts` (`QR_STATUSES`, `QrStatus`)

**Interfaces:**
- Produces: `Container.qrStatus: QrStatus` (default `'none'`), `Container.qrKey: string | null`, `ContainerRepository.setQrPending/setQrReady/setQrFailed(id, ...)` — same signatures as `ItemRepository`'s existing equivalents.

- [ ] Add `qrStatus`/`qrKey` `@Prop` fields to the container schema, mirroring Item's.
- [ ] Add `setQrPending` (atomic `findOneAndUpdate` guard: only transitions when not already `pending`), `setQrReady(id, key)`, `setQrFailed(id)` to `ContainerRepository`.

### Task 2: `ContainerQrService` + `ContainerQrGenerateProcessor`

**Files:**
- Create: `be/src/api/container/constants/container-qr.ts` (payload prefix `c:`, mime, ext, `containerQrStorageKey`)
- Create: `be/src/api/container/constants/container-qr-queue.ts` (`CONTAINER_QR_QUEUE = 'container-qr'`, job name, job data type)
- Create: `be/src/api/container/services/container-qr.service.ts`
- Create: `be/src/api/container/processors/container-qr-generate.processor.ts`

**Interfaces:**
- Consumes: `ContainerRepository`, `StorageService`, `generateQrSvg` (`@/shared/utils/generate-qr`).
- Produces: `ContainerQrService.enqueueGenerate(containerId, ownerId)` (409 if already pending), `ContainerQrService.deleteIfExists(key)`.

- [ ] `ContainerQrService`: injects `ContainerRepository`, `StorageService`, and the `container-qr` queue directly (no cross-module repository injection — this is what keeps Container's QR logic independent of Item's).
- [ ] `ContainerQrGenerateProcessor`: renders the SVG (`c:<id>` payload), uploads to `containerQrStorageKey(ownerId, id)`, calls `setQrReady`; on exhausted retries (`job.attemptsMade >= job.opts.attempts`) calls `setQrFailed`.

### Task 3: Wire Container QR endpoints

**Files:**
- Modify: `be/src/api/container/container.module.ts` (register `container-qr` queue + bull-board panel, add `ContainerQrService`/`ContainerQrGenerateProcessor` to providers)
- Modify: `be/src/api/container/services/container.service.ts` (`getQr`/`generateQr`, root-container 400 guard, `deleteIfExists(container.qrKey)` in `delete()`)
- Create: `be/src/api/container/dto/container-qr-response.dto.ts` (`{ status, url }`)
- Modify: `be/src/api/container/mappers/container.mapper.ts` (`toQrResponseDto`)
- Modify: `be/src/api/container/controllers/container.controller.ts` (`GET`/`POST /:id/qr[/generate]`)

**Interfaces:**
- Produces: `GET /api/v1/containers/:id/qr → ContainerQrResponseDto`, `POST /api/v1/containers/:id/qr/generate → ContainerQrResponseDto` (201, `status: 'pending'`), both 400 on root containers, 404 on missing/foreign container.

- [ ] Implement `getQr`/`generateQr` on `ContainerService` with the `!container.kind → BadRequestException` guard.
- [ ] Wire controller routes + module providers/imports.
- [ ] Verify: `nest build`, restart `start:dev`, confirm boot with no DI errors, curl the full generate → pending → ready cycle plus the root-container 400.

### Task 4: Frontend `services/qr` data layer

**Files:**
- Create: `fe/src/services/qr/api/get-qr.ts`, `fe/src/services/qr/api/generate-qr.ts`, `fe/src/services/qr/api/qr.queries.ts`
- Create: `fe/src/services/qr/index.ts` (exports `qrQueries`, `QrEntityType`)
- Modify: `fe/src/kernel/api/schema.ts` (regenerate via `bun run api:sync` once Task 3 is live)

**Interfaces:**
- Produces: `qrQueries.qr(entityType, entityId)` (query, `refetchInterval` while `status === 'pending'`), `qrQueries.generate()` (mutation, `{ entityType, id }` → invalidates the `qr` query key).

- [ ] `entityType`-parameterized request/query functions hitting `/items/:id/qr` or `/containers/:id/qr` depending on `entityType`.

### Task 5: `features/qr` — `useQr`, `QrTrigger`, `QrModal`, `QrButton`

**Files:**
- Create: `fe/src/features/qr/model/use-qr.ts`
- Create: `fe/src/features/qr/ui/qr-trigger.tsx`, `fe/src/features/qr/ui/qr-modal.tsx`, `fe/src/features/qr/ui/qr-button.tsx`
- Create: `fe/src/features/qr/index.ts` (exports `QrTrigger`, `QrButton`)

**Interfaces:**
- Consumes: `qrQueries` (Task 4), `AdaptiveModal`/`Button`/`useOverlayState`/`Spinner`/`ErrorState` (`@/shared/ui`).
- Produces: `useQr({ entityType, entityId })` → `{ status, url, isGenerating, isDownloading, handleGenerate, handleDownload }`; `<QrTrigger entityType entityId>` (icon button + modal, for detail-page headers); `<QrButton entityType entityId>` (bare icon, generate/download inline, for list rows).

- [ ] `useQr`: wraps `qrQueries.qr`/`qrQueries.generate`, plus client-side blob download (`fetch` → `URL.createObjectURL` → synthetic `<a download>`).
- [ ] `QrModal`: `AdaptiveModal` with heading `QR-код`, body showing failed/ready/generate states (same visual states `QrButton` covers inline, just bigger).
- [ ] `QrTrigger`: `useOverlayState` + icon `Button` + `QrModal`, following the same self-contained trigger+modal shape as `ContainerEdit`.

### Task 6: Compose into detail pages

**Files:**
- Modify: `fe/src/features/item/ui/item.tsx` (new `headerActions?: ReactNode` prop, rendered beside `ItemDeleteTrigger`)
- Modify: `fe/src/pages/item-by-id/ui/item-by-id-page.tsx` (`headerActions={<QrTrigger entityType='item' entityId={id} />}`)
- Modify: `fe/src/pages/container-by-id/ui/container-by-id-page.tsx` (add `{container.kind && <QrTrigger .../>}` into `ContainerHeader`'s existing `actions` render-prop; add `<QrButton>` into both `ContainerList`'s and `ItemList`'s `renderItemActions` row callbacks)

**Interfaces:**
- Consumes: `QrTrigger`/`QrButton` (Task 5).

- [ ] Item: thread `headerActions` through, no new query needed (`Item` already has `item.id`).
- [ ] Container: no new prop on `ContainerHeader` — the page's existing `actions={container => ...}` render-prop already carries `container.kind`, so the root-container gate lives at the same call site as the other header actions.
- [ ] List rows (child containers gated on `child.kind`, items unconditionally): `QrButton`, not `QrTrigger` — no modal for an already-compact row.

### Task 7: Final verification

- [ ] Backend: `nest build`, `bun run lint`, live boot check, curl smoke test (item + container: generate → pending → ready → delete; container root 400 guard).
- [ ] Frontend: `bun run build`, `bun run lint`, manual browser walkthrough — root container shows no QR icon; a non-root container and an item both show the icon in their header; clicking it opens the modal; generate → pending → ready renders the image; download works; closing and reopening preserves state via the shared query cache.
