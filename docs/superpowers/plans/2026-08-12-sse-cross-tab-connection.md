# SSE Cross-Tab Connection Pooling Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Guarantee the app opens at most one physical SSE connection per browser regardless of how many tabs are open, instead of one per tab.

**Architecture:** A new generic `shared/lib/single-tab-connection/` primitive uses the Web Locks API (`navigator.locks`) for cross-tab leader election — every tab with an active listener joins the same lock queue, so failover on tab close is automatic, no separate liveness protocol — and a `BroadcastChannel` to fan events out to every tab. `services/recognition/api/events.ts` is refactored to build its exported `onRecognitionEvent` on top of this primitive instead of its own per-tab `Set<Listener>`/reconnect bookkeeping; its public signature is unchanged, so `services/recognition/model/use-recognition.ts` needs no changes at all.

**Tech Stack:** Native Web Locks API (`navigator.locks`), native `BroadcastChannel`, TypeScript generics — no new dependencies.

## Global Constraints

- Frontend commands run from `fe/`: `bun run build`, `bun run lint`. No automated test runner — verification is build + lint + a manual browser walkthrough.
- Backend needs **zero changes** — this is a purely browser-side connection-sharing concern.
- No fallback for browsers without `navigator.locks`/`BroadcastChannel` — both are Baseline-available since ~2022 (Safari 15.4+). If unavailable, the code throws rather than degrading silently.
- `services/recognition/model/use-recognition.ts` and every other consumer of `onRecognitionEvent` — **zero changes**. The exported signature `onRecognitionEvent(listener: (event: RecognitionSseEvent) => void): () => void` stays identical.
- Both new/touched files keep the codebase's existing WHY-only inline comment style (as in the current `events.ts`) — comments explain non-obvious reasoning, never restate what the code does.
- No `git commit` without a fresh, explicit per-turn user request; project works directly on `main`, no worktrees/feature branches.

---

### Task 1: `shared/lib/single-tab-connection` primitive

**Files:**
- Create: `fe/src/shared/lib/single-tab-connection/types.ts`
- Create: `fe/src/shared/lib/single-tab-connection/single-tab-connection.ts`
- Create: `fe/src/shared/lib/single-tab-connection/index.ts`

**Interfaces:**
- Consumes: nothing project-specific — only native `navigator.locks`/`BroadcastChannel`.
- Produces: `createSingleTabConnection<T>(options: SingleTabConnectionOptions<T>): SingleTabConnection<T>` where `SingleTabConnectionOptions<T> = { name: string; connect: (emit: (event: T) => void, signal: AbortSignal) => Promise<void> }` and `SingleTabConnection<T> = { subscribe: (listener: (event: T) => void) => () => void }`.

- [ ] **Step 1: Create `fe/src/shared/lib/single-tab-connection/types.ts`**

```ts
export interface SingleTabConnectionOptions<T> {
  name: string;
  connect: (emit: (event: T) => void, signal: AbortSignal) => Promise<void>;
}

export interface SingleTabConnection<T> {
  subscribe: (listener: (event: T) => void) => () => void;
}
```

- [ ] **Step 2: Create `fe/src/shared/lib/single-tab-connection/single-tab-connection.ts`**

```ts
import type { SingleTabConnection, SingleTabConnectionOptions } from './types';

export function createSingleTabConnection<T>(
  options: SingleTabConnectionOptions<T>,
): SingleTabConnection<T> {
  const { name, connect } = options;

  // BroadcastChannel не доставляет сообщение самому отправителю — свою же
  // вкладку лидер оповещает отдельным прямым вызовом слушателей в emit ниже
  const channel = new BroadcastChannel(name);
  const listeners = new Set<(event: T) => void>();

  channel.onmessage = (event: MessageEvent<T>) => {
    listeners.forEach(listener => listener(event.data));
  };

  let abortController: AbortController | null = null;

  // каждая вкладка с активным слушателем встаёт в очередь на один и тот же
  // лок — вся логика failover сводится к встроенной в Web Locks очереди:
  // закрылась вкладка-лидер (или её процесс умер) — лок автоматически уходит
  // следующей вкладке в очереди, без ручного отслеживания "жива ли лидер"
  function acquireLeadership(): void {
    abortController = new AbortController();
    const { signal } = abortController;

    void navigator.locks
      .request(name, { signal }, () =>
        connect(event => {
          channel.postMessage(event);
          listeners.forEach(listener => listener(event));
        }, signal),
      )
      .catch(() => {
        // ожидаемый AbortError из releaseLeadership() — не ошибка
      });
  }

  function releaseLeadership(): void {
    // если лок ещё не получен — снимает заявку из очереди;
    // если уже держим — сигналит connect() завершиться, лок освободится
    // как только connect() домотает свой цикл и отдаст управление
    abortController?.abort();
    abortController = null;
  }

  return {
    subscribe(listener: (event: T) => void): () => void {
      listeners.add(listener);

      if (listeners.size === 1) acquireLeadership();

      return () => {
        listeners.delete(listener);

        if (listeners.size === 0) releaseLeadership();
      };
    },
  };
}
```

- [ ] **Step 3: Create `fe/src/shared/lib/single-tab-connection/index.ts`**

```ts
export { createSingleTabConnection } from './single-tab-connection';
export type {
  SingleTabConnection,
  SingleTabConnectionOptions,
} from './types';
```

- [ ] **Step 4: Verify**

Run: `cd fe && bun run build && bun run lint`
Expected: clean. Nothing imports this slice yet, so this only checks the new files type-check and lint standalone.

### Task 2: Refactor `services/recognition/api/events.ts` + final verification

**Files:**
- Modify: `fe/src/services/recognition/api/events.ts`

**Interfaces:**
- Consumes: `createSingleTabConnection` (Task 1), `tokenStorage` (`@/shared/api/token-storage`), `env` (`@/shared/config/env`).
- Produces: `onRecognitionEvent(listener: (event: RecognitionSseEvent) => void): () => void` — **identical signature to today**, no consumer changes needed.

The current file (`fe/src/services/recognition/api/events.ts`) owns three things: (a) module-level `Set<Listener>`/`reconnectTimer`/`abortController` state that gates connect/disconnect on subscriber count, (b) `parseFrame`, and (c) the `fetch` + reconnect-backoff loop. After this task, (a) is deleted — `createSingleTabConnection` from Task 1 owns subscriber bookkeeping and leader election instead — and (b)/(c) remain, reshaped into a `connect(emit, signal)` function that's `signal`-driven instead of listener-count-driven.

- [ ] **Step 1: Rewrite `fe/src/services/recognition/api/events.ts`**

```ts
import { createSingleTabConnection } from '@/shared/lib/single-tab-connection';

import { tokenStorage } from '@/shared/api/token-storage';
import { env } from '@/shared/config/env';

export interface RecognitionSseEvent {
  recognitionId: string;
  status: 'ready' | 'failed';
}

type Listener = (event: RecognitionSseEvent) => void;

// разбирает один SSE-фрейм (event: + data:), интересует только event: recognition
function parseFrame(frame: string): RecognitionSseEvent | null {
  const lines = frame.split('\n');
  const eventLine = lines.find(line => line.startsWith('event:'));
  const dataLine = lines.find(line => line.startsWith('data:'));

  if (!eventLine || !dataLine) return null;
  if (eventLine.slice(6).trim() !== 'recognition') return null;

  try {
    return JSON.parse(dataLine.slice(5).trim()) as RecognitionSseEvent;
  } catch {
    return null;
  }
}

// ждёт delay мс, но выходит раньше, если signal прервали — иначе вкладка,
// у которой только что отписался последний слушатель, держала бы лок ещё
// до 30с (потолок backoff) вместо немедленного освобождения
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
  emit: (event: RecognitionSseEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  let reconnectAttempt = 0;

  while (!signal.aborted) {
    try {
      const access = tokenStorage.getAccess();

      // ручной fetch вместо EventSource — только так можно послать Bearer-заголовок
      const response = await fetch(`${env.apiUrl}/api/v1/recognitions/events`, {
        headers: access ? { Authorization: `Bearer ${access}` } : {},
        signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`SSE connection failed: ${response.status}`);
      }

      reconnectAttempt = 0;

      // ридер сырых байт тела ответа (chunked, соединение держится открытым)
      const reader = response.body.getReader();
      // байты → текст; stream:true — на случай если UTF-8-символ разрезан между чанками
      const decoder = new TextDecoder();
      // текст, накопленный с прошлой итерации, но ещё не сложившийся в целый фрейм
      let buffer = '';

      // цикл живёт, пока сервер не закроет соединение (done:true) или не прилетит abort
      for (;;) {
        const { done, value } = await reader.read();
        if (done) break;

        buffer += decoder.decode(value, { stream: true });

        // фреймы разделены пустой строкой; последний кусок может быть неполным — оставляем в buffer
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

    // экспоненциальный backoff: 1с, 2с, 4с... до потолка 30с
    const delay = Math.min(1000 * 2 ** reconnectAttempt, 30_000);
    reconnectAttempt += 1;

    try {
      await sleep(delay, signal);
    } catch {
      return; // abort прилетел во время ожидания — выходим сразу, без реконнекта
    }
  }
}

const connection = createSingleTabConnection<RecognitionSseEvent>({
  name: 'recognition-events',
  connect,
});

export function onRecognitionEvent(listener: Listener): () => void {
  return connection.subscribe(listener);
}
```

- [ ] **Step 2: Verify build/lint**

Run: `cd fe && bun run build && bun run lint`
Expected: clean. `services/recognition/model/use-recognition.ts` imports `onRecognitionEvent` from this file with the same signature as before, so it needs no changes — confirm the build doesn't flag it.

- [ ] **Step 3: Manual browser walkthrough**

No automated test runner in this project. Start backend (`be`) and frontend (`fe`) dev servers, log in.

1. Open the same logged-in app in **two browser tabs**. In each tab's DevTools → Network, filter for `events`.
2. In tab A, open a container → "Добавить вещь" → trigger a photo recognition ("Заполнить по фото").
3. Confirm in tab A's Network panel a `GET /api/v1/recognitions/events` request is pending (the SSE connection). Confirm tab B's Network panel shows **no** such request yet — it only joins the lock queue once it has its own active listener, and by default nothing in tab B is currently calling `onRecognitionEvent` unless you also have a recognition-consuming view open there. To exercise cross-tab delivery concretely: open the same create-item drawer (or any view that mounts `useRecognition`) in tab B too, *before* starting recognition in tab A, then confirm tab B *also* opens its own `events` request (it's in the lock queue) but recognition status still updates correctly if tab B is not the one that started the recognition (harness note: only the tab that called `start()` has a matching `recognitionId` to react to — this step's real goal is just confirming there is only **one** active/pending `events` request across tabs at any moment, not that every tab reacts to every recognition).
4. Confirm the recognition resolves normally in tab A (form fields populate) exactly as before this refactor.
5. With tab A's recognition flow still mounted (drawer open) and its `events` request the one currently active, close tab A entirely mid-recognition (before it resolves). In tab B, confirm a new `GET /api/v1/recognitions/events` request appears shortly after (leadership failover) — this confirms the lock was released and re-acquired rather than the connection silently dying.
6. Re-run the original single-tab walkthrough from `docs/superpowers/plans/2026-08-02-item-recognition.md` Task 6 (upload photo → confirm ready/failed/cancel paths) to confirm no regression in the single-tab case, which is the common case.

### Self-Review

**Spec coverage:** `shared/lib/single-tab-connection/` primitive (Task 1) ✓, `events.ts` refactor with unchanged `onRecognitionEvent` signature (Task 2) ✓, WHY-only comment style preserved in both files ✓, no backend changes ✓, no fallback for missing `navigator.locks`/`BroadcastChannel` ✓ (not coded defensively — matches the spec's explicit decision), manual multi-tab verification ✓.

**Placeholder scan:** none — both files are complete, runnable code.

**Type consistency:** `SingleTabConnectionOptions<T>`/`SingleTabConnection<T>` (Task 1) match exactly how Task 2 calls `createSingleTabConnection<RecognitionSseEvent>({ name, connect })` and uses the returned `.subscribe`. `RecognitionSseEvent` and the `onRecognitionEvent` signature are unchanged from the current file, so `use-recognition.ts` (untouched) keeps compiling against the same shape.
