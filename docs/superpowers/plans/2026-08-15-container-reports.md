# Container Reports Implementation Plan (v2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let a user generate a PDF report for a container from its detail page, track generation live, download it once ready, and browse/delete their full report history — with the container-page control staying completely stateless so it can never serve a stale report.

**Architecture:** Frontend-only. A `services/report/` data layer (mirroring `services/recognition/`) is shared by `features/report-generate/` (two stateless pieces: a plain navigation link in the container header, and a "generate" banner on the reports page) and `features/report-list/` (the history list, mirroring `features/document-list`). The container header never tracks report status — it only links to `/reports?containerId=<id>`, where the real, timestamped list is the single source of truth for what reports exist and how fresh they are.

**Tech Stack:** React 19 + TanStack Query + TanStack Router (code-based routes, this plan's first use of `validateSearch`) + `zod` (already a dependency) + `openapi-fetch` (`apiClient`) + HeroUI (`@heroui/react` via `@/shared/ui`) + `shared/lib/single-tab-connection` for the SSE stream.

**Spec:** `docs/superpowers/specs/2026-08-15-container-reports-design.md`

## Global Constraints

- Frontend commands run from `fe/`: `bun run build`, `bun run lint`. No automated test runner — verification is build + lint + a manual browser walkthrough.
- Backend needs **zero changes** — `be/src/api/report` is already fully built and already reflected in `fe/src/kernel/api/schema.ts` (no `bun run api:sync` needed).
- FSD layering: `app → pages → features → services → kernel → shared`. Same-layer cross-import is forbidden between `features` or between `services`. Cross-slice imports go through the public barrel (`@/services/report`, `@/features/report-generate`, `@/features/report-list`), never a relative path into another slice's internals.
- User-facing copy is in Russian.
- No `git commit` without a fresh, explicit per-turn user request; project works directly on `main`, no worktrees/feature branches.
- This is a **redesign**. The container-header control is a stateless navigation link (`ReportsLink`) with no query, no mutation, no SSE subscription of its own. All generation, live status, and download happen on `/reports`. Do not reintroduce a persistent "ready" state on the container page — that was the bug in the reverted first attempt.
- Backend enforces a **global** single-active-report constraint (one `pending`/`processing` report per user, across all containers) — a second `POST /reports` while one is active returns `409`. `GET /reports` returns the user's **full** history, unfiltered by container — filtering by container happens client-side in `ReportList`.
- `GET /reports/{id}` is the **only** endpoint that resolves a presigned `downloadUrl` — `GET /reports` (list) always returns `downloadUrl: null`. Every download flow must call `GET /reports/{id}` immediately before downloading, never reuse a `downloadUrl` from the list.
- `ReportsLink` is **not** gated by `container.kind` (unlike `QrTrigger`) — every container can hold items directly and so can have a report generated for it.
- `ReportGenerateBanner` renders nothing (returns `null`) if its `containerId` doesn't resolve (deleted container) — the filtered list below it still works independently.

---

### Task 1: `services/report` data layer

**Files:**
- Create: `fe/src/services/report/api/create.ts`
- Create: `fe/src/services/report/api/list.ts`
- Create: `fe/src/services/report/api/get-by-id.ts`
- Create: `fe/src/services/report/api/delete.ts`
- Create: `fe/src/services/report/api/events.ts`
- Create: `fe/src/services/report/api/report.queries.ts`
- Create: `fe/src/services/report/index.ts`

**Interfaces:**
- Consumes: `apiClient` (`@/shared/api/api-client`), `queryClient` (`@/shared/api/query-client`), `tokenStorage` (`@/shared/api/token-storage`), `env` (`@/shared/config/env`), `createSingleTabConnection` (`@/shared/lib/single-tab-connection`), `components['schemas']['ReportResponseDto']` (`@/kernel/api/schema`).
- Produces: `createReportRequest(containerId: string): Promise<ReportResponseDto>`, `listReportsRequest(): Promise<ReportResponseDto[]>`, `getReportByIdRequest(id: string): Promise<ReportResponseDto>`, `deleteReportRequest(id: string): Promise<void>`, `onReportEvent(listener: (event: ReportSseEvent) => void): () => void` where `ReportSseEvent = { reportId: string; status: 'ready' | 'failed' }`, `reportQueries.listKey` (`readonly ['report', 'list']`), `reportQueries.list()`, `reportQueries.create()`, `reportQueries.delete()`.

- [ ] Create `fe/src/services/report/api/create.ts`:

```ts
import type { components } from '@/kernel/api/schema';
import { apiClient } from '@/shared/api/api-client';

type ReportResponseDto = components['schemas']['ReportResponseDto'];

export async function createReportRequest(
  containerId: string,
): Promise<ReportResponseDto> {
  const { data, error } = await apiClient.POST('/api/v1/reports', {
    body: { containerId },
  });

  if (error) throw error;

  return data!;
}
```

- [ ] Create `fe/src/services/report/api/list.ts`:

```ts
import type { components } from '@/kernel/api/schema';
import { apiClient } from '@/shared/api/api-client';

type ReportResponseDto = components['schemas']['ReportResponseDto'];

export async function listReportsRequest(): Promise<ReportResponseDto[]> {
  const { data, error } = await apiClient.GET('/api/v1/reports');

  if (error) throw error;

  return data!;
}
```

- [ ] Create `fe/src/services/report/api/get-by-id.ts`:

```ts
import type { components } from '@/kernel/api/schema';
import { apiClient } from '@/shared/api/api-client';

type ReportResponseDto = components['schemas']['ReportResponseDto'];

export async function getReportByIdRequest(
  id: string,
): Promise<ReportResponseDto> {
  const { data, error } = await apiClient.GET('/api/v1/reports/{id}', {
    params: { path: { id } },
  });

  if (error) throw error;

  return data!;
}
```

- [ ] Create `fe/src/services/report/api/delete.ts`:

```ts
import { apiClient } from '@/shared/api/api-client';

export async function deleteReportRequest(id: string): Promise<void> {
  const { error } = await apiClient.DELETE('/api/v1/reports/{id}', {
    params: { path: { id } },
  });

  if (error) throw error;
}
```

- [ ] Create `fe/src/services/report/api/events.ts` — structurally identical to `fe/src/services/recognition/api/events.ts`, swapping the event shape and endpoint:

```ts
import { createSingleTabConnection } from '@/shared/lib/single-tab-connection';

import { tokenStorage } from '@/shared/api/token-storage';
import { env } from '@/shared/config/env';

export interface ReportSseEvent {
  reportId: string;
  status: 'ready' | 'failed';
}

type Listener = (event: ReportSseEvent) => void;

// разбирает один SSE-фрейм (event: + data:), интересует только event: report —
// heartbeat-фреймы (event: ping) сюда не попадают, возвращаем null
function parseFrame(frame: string): ReportSseEvent | null {
  const lines = frame.split('\n');
  const eventLine = lines.find(line => line.startsWith('event:'));
  const dataLine = lines.find(line => line.startsWith('data:'));

  if (!eventLine || !dataLine) return null;
  if (eventLine.slice(6).trim() !== 'report') return null;

  try {
    return JSON.parse(dataLine.slice(5).trim()) as ReportSseEvent;
  } catch {
    return null;
  }
}

// ждёт delay мс, но выходит раньше, если signal прервали
function sleep(delay: number, signal: AbortSignal): Promise<void> {
  return new Promise((resolve, reject) => {
    const timer = setTimeout(resolve, delay);

    signal.addEventListener('abort', () => {
      clearTimeout(timer);
      reject(new DOMException('Aborted', 'AbortError'));
    });
  });
}

async function connect(
  emit: (event: ReportSseEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  let reconnectAttempt = 0;

  while (!signal.aborted) {
    try {
      const access = tokenStorage.getAccess();

      // ручной fetch вместо EventSource — только так можно послать Bearer-заголовок
      const response = await fetch(`${env.apiUrl}/api/v1/reports/events`, {
        headers: access ? { Authorization: `Bearer ${access}` } : {},
        signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`SSE connection failed: ${response.status}`);
      }

      reconnectAttempt = 0;

      const reader = response.body.getReader();
      const decoder = new TextDecoder();
      let buffer = '';

      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        const frames = buffer.split('\n\n');
        buffer = frames.pop() ?? '';

        for (const frame of frames) {
          const event = parseFrame(frame);

          if (event) emit(event);
        }
      }
    } catch {
      // сеть/abort — игнорируем, ниже либо выходим (abort), либо уходим в backoff
    }

    if (signal.aborted) return;

    const delay = Math.min(1000 * 2 ** reconnectAttempt, 30_000);
    reconnectAttempt += 1;

    try {
      await sleep(delay, signal);
    } catch {
      return; // abort прилетел во время ожидания — выходим сразу, без реконнекта
    }
  }
}

const connection = createSingleTabConnection<ReportSseEvent>({
  name: 'report-events',
  connect,
});

export function onReportEvent(listener: Listener): () => void {
  return connection.subscribe(listener);
}
```

- [ ] Create `fe/src/services/report/api/report.queries.ts`:

```ts
import { mutationOptions, queryOptions } from '@tanstack/react-query';

import { queryClient } from '@/shared/api/query-client';

import { createReportRequest } from './create';
import { deleteReportRequest } from './delete';
import { listReportsRequest } from './list';

export const reportQueries = {
  listKey: ['report', 'list'] as const,

  list: () =>
    queryOptions({
      queryKey: reportQueries.listKey,
      queryFn: listReportsRequest,
    }),

  create: () =>
    mutationOptions({
      mutationFn: createReportRequest,
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: reportQueries.listKey });
      },
    }),

  delete: () =>
    mutationOptions({
      mutationFn: deleteReportRequest,
      onSuccess: () => {
        queryClient.invalidateQueries({ queryKey: reportQueries.listKey });
      },
    }),
};
```

- [ ] Create `fe/src/services/report/index.ts`:

```ts
export { getReportByIdRequest } from './api/get-by-id';
export { onReportEvent, type ReportSseEvent } from './api/events';
export { reportQueries } from './api/report.queries';
```

- [ ] Verify: `cd fe && bun run build && bun run lint` — clean (nothing imports this slice yet, so this only checks the new files type-check and lint standalone).

### Task 2: `features/report-generate` (link + banner) + wire the link into the container page

**Files:**
- Create: `fe/src/features/report-generate/ui/reports-link.tsx`
- Create: `fe/src/features/report-generate/ui/report-generate-banner.tsx`
- Create: `fe/src/features/report-generate/index.ts`
- Modify: `fe/src/pages/container-by-id/ui/container-by-id-page.tsx`

**Interfaces:**
- Consumes: `reportQueries` (Task 1, `@/services/report`), `containerQueries` (`@/services/container`), `ROUTES` (`@/kernel/routes`), `Button`/`Spinner`/`Typography`/`toast` (`@/shared/ui`), `Link` (`@tanstack/react-router`).
- Produces: `<ReportsLink containerId={string} />`, `<ReportGenerateBanner containerId={string} />`.

Neither component holds report status, subscribes to SSE, or knows about `pending`/`processing`/`ready`/`failed` beyond `ReportGenerateBanner`'s own in-flight mutation — that's the whole point of this redesign.

- [ ] Create `fe/src/features/report-generate/ui/reports-link.tsx`:

```tsx
import { Link } from '@tanstack/react-router';
import { FileBarChart } from 'lucide-react';

import { ROUTES } from '@/kernel/routes';

interface Props {
  containerId: string;
}

export function ReportsLink(props: Props) {
  const { containerId } = props;

  return (
    <Link
      to={ROUTES.REPORTS}
      search={{ containerId }}
      aria-label='Отчёты по контейнеру'
      className='flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-secondary hover:text-primary'
    >
      <FileBarChart size={16} />
    </Link>
  );
}
```

- [ ] Create `fe/src/features/report-generate/ui/report-generate-banner.tsx`:

```tsx
import { useMutation, useQuery } from '@tanstack/react-query';

import { containerQueries } from '@/services/container';
import { reportQueries } from '@/services/report';

import { Button, Spinner, Typography, toast } from '@/shared/ui';

function isStatusCode(err: unknown, code: number): boolean {
  return (
    err !== null &&
    typeof err === 'object' &&
    'statusCode' in err &&
    (err as { statusCode?: number }).statusCode === code
  );
}

interface Props {
  containerId: string;
}

export function ReportGenerateBanner(props: Props) {
  const { containerId } = props;

  const { data: container, isError } = useQuery(
    containerQueries.byId(containerId),
  );

  const { mutate: createReport, isPending } = useMutation(
    reportQueries.create(),
  );

  // контейнер с тех пор удалили (404) или другая ошибка загрузки — баннер
  // генерации не показываем, но список отчётов ниже работает независимо
  if (isError || !container) return null;

  const handleGenerate = () => {
    createReport(containerId, {
      onError: err => {
        if (isStatusCode(err, 409)) {
          toast.danger('Уже есть активный отчёт — дождитесь его завершения');
          return;
        }

        if (isStatusCode(err, 400)) {
          toast.danger('Слишком много вещей в контейнере для отчёта');
          return;
        }

        toast.danger('Не удалось запустить формирование отчёта');
      },
    });
  };

  return (
    <div className='flex items-center justify-between gap-3 rounded-lg border border-border p-3'>
      <Typography type='body-sm' weight='medium'>
        {container.name}
      </Typography>

      <Button
        type='button'
        size='sm'
        isDisabled={isPending}
        onPress={handleGenerate}
      >
        {isPending ? <Spinner size='sm' /> : 'Сформировать отчёт'}
      </Button>
    </div>
  );
}
```

- [ ] Create `fe/src/features/report-generate/index.ts`:

```ts
export { ReportGenerateBanner } from './ui/report-generate-banner';
export { ReportsLink } from './ui/reports-link';
```

- [ ] Modify `fe/src/pages/container-by-id/ui/container-by-id-page.tsx`:
  - Add the import, right after the existing `@/features/qr` import (alphabetically next):
    ```ts
    import { QrButton, QrTrigger } from '@/features/qr';
    import { ReportsLink } from '@/features/report-generate';
    ```
  - In the `ContainerHeader`'s `actions` render prop, add `<ReportsLink containerId={container.id} />` right after the existing `QrTrigger` block — **not** wrapped in the `container.kind &&` gate (see Global Constraints):
    ```tsx
              <>
                {container.kind && (
                  <QrTrigger
                    entityId={container.id}
                    qrQueryOptions={containerQueries.qr(container.id)}
                    generateMutationOptions={containerQueries.generateQr()}
                  />
                )}
                <ReportsLink containerId={container.id} />
                <ContainerEdit
                  containerId={container.id}
                  parentId={container.parentId}
                  name={container.name}
                />
    ```

- [ ] Verify: `cd fe && bun run build && bun run lint` — clean. (`ReportsLink`'s `search={{ containerId }}` will not type-check against the `/reports` route yet — that route doesn't exist until Task 4. **Skip this verify step for now and come back to it at the end of Task 4** — note this explicitly when running Task 2 so the failing build isn't mistaken for a real bug.)

### Task 3: `features/report-list`

**Files:**
- Create: `fe/src/features/report-list/ui/report-card.tsx`
- Create: `fe/src/features/report-list/ui/report-list.tsx`
- Create: `fe/src/features/report-list/index.ts`

**Interfaces:**
- Consumes: `getReportByIdRequest`, `onReportEvent`, `reportQueries` (Task 1, `@/services/report`), `containerQueries` (`@/services/container`), `components['schemas']['ReportResponseDto']` (`@/kernel/api/schema`), `AlertDialog`/`Button`/`Chip`/`EmptyState`/`ErrorState`/`Skeleton`/`Spinner`/`Typography`/`toast`/`useOverlayState` (`@/shared/ui`).
- Produces: `<ReportList containerId={string | undefined} />` (prop is optional — omit it entirely for the unfiltered view).

- [ ] Create `fe/src/features/report-list/ui/report-card.tsx`:

```tsx
import { useState } from 'react';

import { useMutation, useQuery } from '@tanstack/react-query';
import { Download, Trash2 } from 'lucide-react';

import { containerQueries } from '@/services/container';
import { getReportByIdRequest, reportQueries } from '@/services/report';

import type { components } from '@/kernel/api/schema';

import {
  AlertDialog,
  Button,
  Chip,
  Spinner,
  Typography,
  toast,
  useOverlayState,
} from '@/shared/ui';

type ReportResponseDto = components['schemas']['ReportResponseDto'];

const STATUS_LABELS: Record<ReportResponseDto['status'], string> = {
  pending: 'Ожидание',
  processing: 'Формируется',
  ready: 'Готово',
  failed: 'Ошибка',
};

// HeroUI Chip's color union is 'default'|'accent'|'success'|'warning'|'danger'
// (see @heroui/styles chip.styles.d.ts) — no 'primary', hence 'accent' here.
const STATUS_COLORS: Record<
  ReportResponseDto['status'],
  'default' | 'accent' | 'success' | 'danger'
> = {
  pending: 'default',
  processing: 'accent',
  ready: 'success',
  failed: 'danger',
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;

  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

interface Props {
  report: ReportResponseDto;
}

export function ReportCard(props: Props) {
  const { report } = props;

  const { data: container, isError: isContainerError } = useQuery(
    containerQueries.byId(report.containerId),
  );

  const [isDownloading, setIsDownloading] = useState(false);
  const deleteState = useOverlayState();

  const { mutateAsync: deleteReport, isPending: isDeleting } = useMutation(
    reportQueries.delete(),
  );

  const handleDownload = async () => {
    setIsDownloading(true);

    try {
      const fresh = await getReportByIdRequest(report.id);

      if (!fresh.downloadUrl) throw new Error('Report has no downloadUrl');

      const response = await fetch(fresh.downloadUrl);
      const blob = await response.blob();
      const blobUrl = URL.createObjectURL(blob);

      const link = document.createElement('a');
      link.href = blobUrl;
      link.download = `report-${report.containerId}.pdf`;
      link.click();

      URL.revokeObjectURL(blobUrl);
    } catch {
      toast.danger('Не удалось скачать отчёт');
    } finally {
      setIsDownloading(false);
    }
  };

  const handleDelete = async () => {
    try {
      await deleteReport(report.id);
      deleteState.close();
    } catch {
      toast.danger('Не удалось удалить отчёт');
    }
  };

  // 404 (контейнер с тех пор удалили) и любая другая ошибка загрузки контейнера
  // трактуются одинаково — карточка отчёта не должна ломаться из-за этого
  const containerName = isContainerError
    ? 'Контейнер удалён'
    : (container?.name ?? '…');

  return (
    <div className='flex items-center gap-3 rounded-lg border border-border p-3'>
      <div className='flex flex-1 flex-col items-start gap-1'>
        <div className='flex items-center gap-2'>
          <Typography type='body-sm' weight='medium'>
            {containerName}
          </Typography>
          <Chip size='sm' color={STATUS_COLORS[report.status]}>
            {STATUS_LABELS[report.status]}
          </Chip>
        </div>

        <Typography type='body-xs' color='muted'>
          {new Date(report.createdAt).toLocaleDateString('ru-RU')}
          {report.itemCount !== null && ` · ${report.itemCount} вещей`}
          {report.fileSize !== null && ` · ${formatFileSize(report.fileSize)}`}
        </Typography>
      </div>

      {report.status === 'ready' && (
        <button
          type='button'
          aria-label='Скачать отчёт'
          disabled={isDownloading}
          onClick={() => void handleDownload()}
          className='flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-secondary hover:text-primary disabled:pointer-events-none'
        >
          {isDownloading ? <Spinner size='sm' /> : <Download size={16} />}
        </button>
      )}

      <button
        type='button'
        aria-label='Удалить отчёт'
        onClick={deleteState.open}
        className='flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-secondary hover:text-danger'
      >
        <Trash2 size={16} />
      </button>

      <AlertDialog.Root
        isOpen={deleteState.isOpen}
        onOpenChange={deleteState.setOpen}
      >
        <AlertDialog.Backdrop>
          <AlertDialog.Container>
            <AlertDialog.Dialog>
              <div className='flex items-center gap-3'>
                <AlertDialog.Icon />
                <AlertDialog.Header className='mb-0'>
                  <AlertDialog.Heading>Удалить отчёт?</AlertDialog.Heading>
                </AlertDialog.Header>
              </div>
              <AlertDialog.Body className='mt-2'>
                Это действие нельзя отменить.
              </AlertDialog.Body>
              <AlertDialog.Footer>
                <Button
                  type='button'
                  variant='ghost'
                  onPress={deleteState.close}
                >
                  Отмена
                </Button>
                <Button
                  type='button'
                  variant='danger'
                  isDisabled={isDeleting}
                  onPress={() => void handleDelete()}
                >
                  Удалить
                </Button>
              </AlertDialog.Footer>
            </AlertDialog.Dialog>
          </AlertDialog.Container>
        </AlertDialog.Backdrop>
      </AlertDialog.Root>
    </div>
  );
}
```

- [ ] Create `fe/src/features/report-list/ui/report-list.tsx`:

```tsx
import { useEffect } from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileStack } from 'lucide-react';

import { onReportEvent, reportQueries } from '@/services/report';

import { EmptyState, ErrorState, Skeleton } from '@/shared/ui';

import { ReportCard } from './report-card';

interface Props {
  containerId?: string;
}

export function ReportList(props: Props) {
  const { containerId } = props;

  const queryClient = useQueryClient();

  const {
    data: reports,
    isPending,
    isError,
    refetch,
  } = useQuery(reportQueries.list());

  // живое обновление: любое SSE-событие инвалидирует список, независимо от
  // активного клиентского фильтра по контейнеру
  useEffect(() => {
    const listener = onReportEvent(() => {
      void queryClient.invalidateQueries({ queryKey: reportQueries.listKey });
    });

    return () => {
      listener();
    };
  }, [queryClient]);

  if (isPending) {
    return (
      <div className='flex flex-col gap-2'>
        <Skeleton className='h-16 w-full rounded-lg' />
        <Skeleton className='h-16 w-full rounded-lg' />
      </div>
    );
  }

  if (isError) {
    return (
      <ErrorState onRetry={() => refetch()}>
        Не удалось загрузить отчёты
      </ErrorState>
    );
  }

  const filtered = containerId
    ? reports.filter(r => r.containerId === containerId)
    : reports;

  const sorted = [...filtered].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  if (sorted.length === 0) {
    return <EmptyState icon={FileStack}>Отчётов пока нет</EmptyState>;
  }

  return (
    <div className='flex flex-col gap-2'>
      {sorted.map(report => (
        <ReportCard key={report.id} report={report} />
      ))}
    </div>
  );
}
```

- [ ] Create `fe/src/features/report-list/index.ts`:

```ts
export { ReportList } from './ui/report-list';
```

- [ ] Verify: `cd fe && bun run build && bun run lint` — clean (still unused by any page — that's Task 4).

### Task 4: `/reports` page, routing (`validateSearch`), header nav link — and fix Task 2's build

**Files:**
- Create: `fe/src/pages/reports/ui/reports-page.tsx`
- Create: `fe/src/pages/reports/index.ts`
- Modify: `fe/src/kernel/routes.ts`
- Modify: `fe/src/app/routes/router.tsx`
- Modify: `fe/src/features/header/ui/header-desktop-content.tsx`
- Modify: `fe/src/features/header/ui/header-mobile-content.tsx`

**Interfaces:**
- Consumes: `ReportGenerateBanner`, `ReportsLink` (Task 2, `@/features/report-generate`), `ReportList` (Task 3, `@/features/report-list`), `ROUTES` (`@/kernel/routes`).
- Produces: `<ReportsPage />`, `ROUTES.REPORTS = '/reports'`, the `/reports` route with `validateSearch: (search) => ({ containerId: search.containerId as string | undefined })` typed via a `zod` schema.

- [ ] Create `fe/src/pages/reports/ui/reports-page.tsx`:

```tsx
import { Link, useSearch } from '@tanstack/react-router';

import { ReportGenerateBanner } from '@/features/report-generate';
import { ReportList } from '@/features/report-list';

import { ROUTES } from '@/kernel/routes';

import { Typography } from '@/shared/ui';

export function ReportsPage() {
  const { containerId } = useSearch({ from: '/protected/reports' });

  return (
    <div className='flex flex-1 flex-col items-center p-4'>
      <div className='flex w-full max-w-2xl flex-col gap-4'>
        <Typography type='h3'>Мои отчёты</Typography>

        {containerId && (
          <>
            <ReportGenerateBanner containerId={containerId} />
            <Link to={ROUTES.REPORTS} search={{}} className='self-start'>
              <Typography type='body-sm' color='muted'>
                Показать все отчёты
              </Typography>
            </Link>
          </>
        )}

        <ReportList containerId={containerId} />
      </div>
    </div>
  );
}
```

- [ ] Create `fe/src/pages/reports/index.ts`:

```ts
export { ReportsPage } from './ui/reports-page';
```

- [ ] Modify `fe/src/kernel/routes.ts` — add `REPORTS` (keep alongside `PROFILE`, both are top-level protected pages unrelated to a specific entity):

```ts
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  PROFILE: '/profile',
  REPORTS: '/reports',
  CONTAINER_BY_ID: '/containers/$id',
  ITEM_BY_ID: '/items/$id',
} as const;
```

- [ ] Modify `fe/src/app/routes/router.tsx`:
  - Add the `zod` import at the top, and the `ReportsPage` import alphabetically right after `LoginPage`:
    ```ts
    import { z } from 'zod';

    import { LoginPage } from '@/pages/login';
    import { ReportsPage } from '@/pages/reports';
    import { UserProfilePage } from '@/pages/user-profile';
    ```
  - Add the search-params schema and a new route definition right after `profileRoute`:
    ```ts
    const reportsSearchSchema = z.object({
      containerId: z.string().optional(),
    });

    const reportsRoute = createRoute({
      getParentRoute: () => protectedRoute,
      path: ROUTES.REPORTS,
      component: ReportsPage,
      validateSearch: reportsSearchSchema,
    });
    ```
  - Add `reportsRoute` to `protectedRoutes`:
    ```ts
    const protectedRoutes = protectedRoute.addChildren([
      indexRoute,
      profileRoute,
      reportsRoute,
      containerByIdRoute,
      itemByIdRoute,
    ]);
    ```

- [ ] Modify `fe/src/features/header/ui/header-desktop-content.tsx` — add a second `Link` next to the existing `PROFILE` one (no `search` prop — defaults to the unfiltered view):

```tsx
import { Link } from '@tanstack/react-router';

import { ROUTES } from '@/kernel/routes';

import { Button, Skeleton, Typography } from '@/shared/ui';

interface Props {
  email?: string;
  isPending: boolean;
  isLoggingOut: boolean;
  onLogout: () => void;
}

export function HeaderDesktopContent(props: Props) {
  return (
    <div className='hidden items-center gap-3 sm:flex'>
      <Link to={ROUTES.PROFILE}>
        {props.isPending ? (
          <Skeleton className='h-4 w-32' />
        ) : (
          <Typography type='body-sm' color='muted'>
            {props.email}
          </Typography>
        )}
      </Link>

      <Link to={ROUTES.REPORTS}>
        <Typography type='body-sm' color='muted'>
          Мои отчёты
        </Typography>
      </Link>

      <Button
        type='button'
        isDisabled={props.isLoggingOut}
        onPress={props.onLogout}
      >
        Выйти
      </Button>
    </div>
  );
}
```

- [ ] Modify `fe/src/features/header/ui/header-mobile-content.tsx` — add a second entry to the `actions` array, before `logout`:

```tsx
import { useNavigate } from '@tanstack/react-router';
import { Menu as MenuIcon } from 'lucide-react';

import { ROUTES } from '@/kernel/routes';

import { Dropdown } from '@/shared/ui';

interface Props {
  isLoggingOut: boolean;
  onLogout: () => void;
}

export function HeaderMobileContent(props: Props) {
  const navigate = useNavigate();

  const actions = [
    {
      id: 'profile',
      label: 'Профиль',
      onAction: () => void navigate({ to: ROUTES.PROFILE }),
    },
    {
      id: 'reports',
      label: 'Мои отчёты',
      onAction: () => void navigate({ to: ROUTES.REPORTS }),
    },
    {
      id: 'logout',
      label: 'Выйти',
      onAction: props.onLogout,
      isDisabled: props.isLoggingOut,
    },
  ];

  return (
    <div className='sm:hidden'>
      <Dropdown.Root>
        <Dropdown.Trigger
          aria-label='Меню'
          className='flex size-9 items-center justify-center rounded-lg border border-border bg-surface text-foreground transition-colors hover:bg-surface-secondary'
        >
          <MenuIcon size={18} />
        </Dropdown.Trigger>

        <Dropdown.Popover>
          <Dropdown.Menu>
            {actions.map(action => (
              <Dropdown.Item
                key={action.id}
                id={action.id}
                onAction={action.onAction}
                isDisabled={action.isDisabled}
              >
                {action.label}
              </Dropdown.Item>
            ))}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown.Root>
    </div>
  );
}
```

- [ ] Verify: `cd fe && bun run build && bun run lint` — clean. This is also the point where Task 2's `ReportsLink` (`search={{ containerId }}`) finally type-checks, since the `/reports` route with its `validateSearch` schema now exists — if `search={{ containerId }}` in `reports-link.tsx` errors here, it means the route's search-param typing doesn't match; double-check `reportsSearchSchema` was added and `reportsRoute` is registered in `protectedRoutes` before debugging further.
- [ ] Manual check: confirm "Мои отчёты" appears in the header (desktop link next to the email/profile link; mobile inside the hamburger menu) and navigates to `/reports` with no banner and the full unfiltered list (or the "Отчётов пока нет" empty state). Then go to a container's detail page, click the new reports icon in its header, and confirm it lands on `/reports?containerId=<id>` with a banner showing that container's name and a list filtered to just that container.

### Task 5: Final verification

**Files:** None (verification only).

- [ ] Run `cd fe && bun run build && bun run lint` one more time on the full feature — clean.
- [ ] Full manual browser walkthrough (backend + frontend dev servers running, logged in, at least one container with a few items), per the spec's Testing/Verification section:
  1. Open a container's detail page, click the reports icon — lands on `/reports?containerId=X` with the banner showing that container's name and a filtered (possibly empty) list.
  2. Click "Сформировать отчёт" — a `pending` card appears in the filtered list immediately; once the backend finishes, it updates live to `ready` via SSE with no reload. Download it and confirm the PDF matches the container's current contents.
  3. Add or remove an item in that container, return to `/reports?containerId=X`, click "Сформировать отчёт" again — confirm a **second, distinct** report card appears (proves there's no persisted "the" report per container anywhere in the UI — this is the exact scenario that was broken in the reverted first attempt).
  4. Click "Показать все отчёты" — confirm the filter clears and reports from other containers are visible too.
  5. Navigate to `/reports` directly via the header's "Мои отчёты" link (no `containerId` in the URL) — confirm no banner renders and the full list shows.
  6. While a report is generating for one container (banner shows a spinner), open a *different* container's reports link and click "Сформировать отчёт" there — confirm the `409` toast ("Уже есть активный отчёт — дождитесь его завершения").
  7. Visit `/reports?containerId=<id-of-a-deleted-container>` (delete a container that has at least one existing report first) — confirm no generate banner renders, but that container's past reports still show in the filtered list with the "Контейнер удалён" fallback name.
  8. Delete a report from the list (trash icon → confirm in `AlertDialog`) — confirm it disappears, regardless of whether the list is currently filtered or not.
  9. Delete all reports for a filtered container and confirm the "Отчётов пока нет" empty state renders under the (still-visible) generate banner.
