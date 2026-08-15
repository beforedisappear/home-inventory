# Container Reports — Design (v2)

## Goal

Let a user generate a PDF report for a container (list of items with photos and custom fields), track its generation status live, download it once ready, and browse/delete their report history — without the UI ever silently serving a report that's stale relative to the container's current contents.

## Context

This is a redo of an earlier design. The first implementation put a stateful icon-button in the container header: idle → spinner → permanent "download" icon once a report finished. The permanent download state was the bug — after the report was ready, the button never offered a way to regenerate, so adding an item to the container and clicking the button again just re-downloaded the same stale PDF. Two in-place patches (a second "regenerate" icon; then a single auto-download-and-reset button) were both rejected. This version removes the underlying cause instead of patching around it: the container-page control no longer tracks or represents report state at all.

Backend (`be/src/api/report`) is fully built and unchanged from the first attempt:

- `POST /api/v1/reports` `{containerId}` → enqueues a BullMQ job, returns `ReportResponseDto` with `status: 'pending'`.
- `GET /api/v1/reports` → full report history for the user, across all containers — no `containerId` filter param exists.
- `GET /api/v1/reports/{id}` → single report; the **only** endpoint that resolves `downloadUrl` (a presigned S3 URL, `null` everywhere else, including in the list response).
- `GET /api/v1/reports/events` (SSE) → `event: report` frames `{reportId, status: 'ready'|'failed'}`, plus `event: ping` heartbeats every 25s.
- `DELETE /api/v1/reports/{id}` → deletes the record and the S3 file.
- **Global single-flight constraint**: one `pending`/`processing` report per user at a time, across all containers — a second `POST /reports` while one is active returns `409`.
- `400` if the target container has more items than `REPORT_ITEMS_HARD_CAP`.

`ReportResponseDto`: `{ id, status: 'pending'|'processing'|'ready'|'failed', containerId, itemCount: number|null, fileSize: number|null, downloadUrl: string|null, error: string|null, createdAt, completedAt: string|null }`. Already reflected in `fe/src/kernel/api/schema.ts` — no regeneration needed. `ItemResponseDto` additionally carries `createdAt`/`updatedAt` (Mongoose timestamps), which the first design considered using for a client-side staleness indicator — that path was explored and dropped in favor of the simpler structural fix below (see Approaches Considered).

## Approaches Considered

1. **Staleness badge on a persistent button** — compare max `item.updatedAt` / `items.length` against the latest report's `createdAt`/`itemCount` to show "may be outdated" on the container-page button. Rejected: adds a second source of truth (derived freshness) that can itself be wrong (e.g., an item's custom fields changed without bumping what the report renders, or vice versa), and keeps the exact stateful-button shape that caused confusion once already.
2. **One-shot auto-download button** (second patch, already tried) — click generates, auto-downloads on ready, resets to idle; no persisted ready-state. Rejected by the user without a specific reason given, but architecturally it still couples "trigger" and "status display" into one control that has to reason about pending/processing/ready/failed.
3. **Chosen: split trigger from status display.** The container header keeps only a stateless navigation link — no report status is ever computed or rendered there. All generation, status, and download happen on the `/reports` page, which already renders real data (timestamps, status chips) rather than a single button's derived label. Freshness is never in question because there's nothing claiming to represent "the" report for a container outside of a real, timestamped list.

## Scope

**In scope:**

- `ReportsLink` — a stateless icon-link in the container header (next to the existing QR/edit/delete icons) that navigates to `/reports?containerId=<id>`. Carries no report status, no query, no SSE subscription.
- `/reports` page reads an optional `containerId` search param. When present:
  - Shows a `ReportGenerateBanner` with the container's name and a "Сформировать отчёт" button that fires `POST /reports` for that container.
  - Filters the report list to that container's reports only.
  - Shows a "Показать все отчёты" link that clears the search param (returns to the unfiltered view).
- When `containerId` is absent (e.g. arrived via the "Мои отчёты" header nav link), the page behaves exactly as a plain, unfiltered history list — no banner.
- If the `containerId` in the URL points at a deleted container (404 on lookup), the generate banner does not render, but the list stays filtered to that id (old reports for a deleted container should still be visible and downloadable, per the existing "Контейнер удалён" fallback already used in report cards).
- Live SSE status updates on `/reports` (already-correct behavior from the first attempt, carried over unchanged).
- Header nav link "Мои отчёты" → `/reports` with no search params (carried over unchanged).

**Out of scope:**

- Any backend change.
- A `containerId` filter on `GET /reports` — filtering stays client-side, same as the first design.
- Any staleness heuristic/badge (see Approaches Considered #1) — rejected in favor of removing the stateful button entirely.
- Auto-download on ready, or any other container-header affordance that implies "here is your report" — the container header's only report-related affordance is the navigation link.
- Per-report progress percentage (backend doesn't expose it).
- Editing/regenerating a report in place — regeneration is just another `POST /reports` for the same container, initiated from the banner.

## Architecture

### `services/report/` — unchanged from the first attempt

Same shape as originally built: `api/create.ts`, `api/list.ts`, `api/get-by-id.ts`, `api/delete.ts` (thin `apiClient` wrappers), `api/events.ts` (SSE reader on `shared/lib/single-tab-connection`, mirroring `services/recognition/api/events.ts`), `api/report.queries.ts` (`listKey`, `list()`, `create()`, `delete()` — `create()`/`delete()` invalidate `listKey` on success), `index.ts` barrel. No design changes here — the data layer was never the problem.

### `features/report-generate/` — redesigned, two independent exports, no shared stateful hook

- `ui/reports-link.tsx` — `ReportsLink({ containerId }: { containerId: string })`. A `Link` from `@tanstack/react-router` (`to={ROUTES.REPORTS} search={{ containerId }}`), styled with the same icon-button tailwind classes already used for equivalent controls in this codebase (e.g. `report-card.tsx`'s download/delete buttons: `flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-secondary hover:text-primary`), `FileBarChart` icon, `aria-label='Отчёты по контейнеру'`. No query, no state, no mutation — purely a styled navigation link. **Not** gated by `container.kind` (every container can hold items directly).
- `ui/report-generate-banner.tsx` — `ReportGenerateBanner({ containerId }: { containerId: string })`. Resolves the container's name via `containerQueries.byId(containerId)`; if that query errors (404), the component renders `null` (no banner at all — list filtering is handled independently by the page). On success, renders the container name plus a "Сформировать отчёт" button wired to `useMutation(reportQueries.create())`: `isPending` drives a spinner/disabled state; `onError` handling is the same 409/400/generic toast triage as the first design (`toast.danger('Уже есть активный отчёт — дождитесь его завершения')` / `toast.danger('Слишком много вещей в контейнере для отчёта')` / `toast.danger('Не удалось запустить формирование отчёта')`). On success, nothing further happens in this component — `reportQueries.create()`'s existing `onSuccess` already invalidates `listKey`, so the new `pending` report appears in the list below on its own; no local state to reset.
- `index.ts` — barrel exporting `ReportsLink` and `ReportGenerateBanner`.

### `features/report-list/` — one small addition, otherwise unchanged

- `ui/report-card.tsx` — unchanged from the first attempt (status chip, container name resolution with "Контейнер удалён" fallback, download button when `status === 'ready'`, delete with `AlertDialog`).
- `ui/report-list.tsx` — gains an optional prop: `ReportList({ containerId }: { containerId?: string })`. When `containerId` is provided, the already-fetched `reportQueries.list()` data is filtered to `r => r.containerId === containerId` before the existing sort/render/empty-state logic runs. The empty-state copy stays the same ("Отчётов пока нет") whether or not a filter is active — no separate "this container has no reports yet" string, to avoid threading extra copy through a prop for marginal benefit. The existing SSE subscription (invalidates `listKey` on any event) is unchanged — it doesn't need to know about the filter, since filtering happens after the query resolves.
- `index.ts` — unchanged export.

### `pages/reports/` — gains search-param handling

- `ui/reports-page.tsx` — reads `containerId` via the route's typed search params. If present: renders `<ReportGenerateBanner containerId={containerId} />`, a "Показать все отчёты" `Link` (`to={ROUTES.REPORTS} search={{}}`) shown only in this branch, and `<ReportList containerId={containerId} />`. If absent: renders just `<ReportList />` (no banner, no clear-filter link) — identical to today's plain history view.
- Route registration (`app/routes/router.tsx`): the `/reports` route gains `validateSearch` using `zod` (already a project dependency, first use of `validateSearch` in this app): `z.object({ containerId: z.string().optional() })`.

### Wiring

- `pages/container-by-id/ui/container-by-id-page.tsx`: replace where the old `ReportButton` would have gone with `<ReportsLink containerId={container.id} />`, in the same position (after `QrTrigger`, before `ContainerEdit`), still unconditional (not wrapped in `container.kind &&`).
- `features/header`: unchanged from the first design — desktop and mobile nav both get a "Мои отчёты" entry pointing at `/reports` with no search params.

## Data Flow

**Entry from a container:** click `ReportsLink` in the container header → navigate to `/reports?containerId=X` → page renders `ReportGenerateBanner` (container name + button) and a list filtered to that container.

**Generating:** click "Сформировать отчёт" → `POST /reports {containerId}` → mutation's built-in `onSuccess` invalidates `listKey` → the new `pending` report appears in the (filtered) list → the existing SSE subscription in `ReportList` invalidates `listKey` again on the matching `event: report` frame once the backend finishes → the card updates live to `ready` or `failed`. Nothing in the banner itself tracks this — it only fires the mutation and reflects its own `isPending`.

**Downloading:** unchanged — click the download icon on a `ready` card → `getReportByIdRequest(id)` resolves a fresh `downloadUrl` → `fetch` → blob → synthetic `<a download>` click. Always resolved fresh per report id, so there's no risk of a stale presigned URL; and since every report row is its own immutable record with its own real `createdAt`, there's no ambiguity about which container-state it reflects.

**Clearing the filter:** click "Показать все отчёты" → navigate to `/reports` with no search params → banner disappears, list shows everything.

**Deleting:** unchanged — trash icon → `AlertDialog` confirm → `DELETE /reports/{id}` → invalidate `listKey` → row disappears (from whichever view, filtered or not).

## Error Handling

- `409` on create (banner) → `toast.danger('Уже есть активный отчёт — дождитесь его завершения')`; banner button returns to its idle (enabled) state.
- `400` (item cap exceeded) on create → `toast.danger('Слишком много вещей в контейнере для отчёта')`.
- Any other create error → `toast.danger('Не удалось запустить формирование отчёта')`.
- Container lookup 404 for the banner (deleted container) → banner renders nothing; the rest of the page (filtered list) still works.
- Download/delete failures — unchanged from the first design (`toast.danger('Не удалось скачать отчёт')` / `toast.danger('Не удалось удалить отчёт')`).
- List load failure — unchanged (`ErrorState` with retry).

## Testing / Verification

No automated test runner in this project. `bun run build` + `bun run lint`, plus a manual walkthrough:

1. Open a container's detail page, click the reports icon — lands on `/reports?containerId=X` with the banner showing that container's name and a filtered (possibly empty) list.
2. Click "Сформировать отчёт" — a `pending` card appears in the filtered list immediately; once the backend finishes, it updates live to `ready` via SSE with no reload.
3. Download the ready report from its card; confirm the PDF matches the container's current contents.
4. Add/remove an item in that container, return to `/reports?containerId=X`, generate again — confirm a second, distinct report appears (proves there's no persisted "the" report per container anywhere in the UI).
5. Click "Показать все отчёты" — confirm the filter clears and all containers' reports are visible.
6. Navigate to `/reports` directly via the header's "Мои отчёты" link (no `containerId`) — confirm no banner renders, full list shows.
7. While a report is generating for one container, open a different container's reports link and try to generate — confirm the `409` toast.
8. Visit `/reports?containerId=<id-of-a-deleted-container>` — confirm no generate banner renders, but that container's past reports (if any) still show in the filtered list with the "Контейнер удалён" fallback name.
9. Delete a report from the list; confirm it disappears regardless of whether the list is filtered or not.
