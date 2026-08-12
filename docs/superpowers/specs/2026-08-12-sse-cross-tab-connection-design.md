# SSE Cross-Tab Connection Pooling — Design

## Goal

Ensure the app never opens more than one physical SSE connection to the backend per browser, regardless of how many tabs of the app the user has open. Today each tab holds its own independent SSE connection; on HTTP/1.1 each one permanently occupies one of the browser's ~6 same-origin connection slots, so a handful of open tabs can starve ordinary API requests in a queue. This is orthogonal to (and doesn't replace) moving the backend to HTTP/2, which removes the per-connection-slot ceiling entirely — this fix targets the case where HTTP/2 isn't available, and reduces the app's own connection footprint regardless.

## Context

The only current SSE consumer is `services/recognition/api/events.ts`: a module-level singleton that opens one `fetch`-based SSE connection per browser tab (connects on the first `onRecognitionEvent` subscriber, disconnects when the last one unsubscribes), with hand-rolled `event:`/`data:` frame parsing and exponential-backoff reconnect. This is fine within a single tab — it already dedupes multiple in-tab subscribers onto one connection — but each tab is a separate JS realm, so N tabs still mean N connections.

`fe/src/shared/lib/` already hosts small, feature-agnostic browser-capability wrappers (`event-emitter/`, `device-type/`) that any slice can depend on. The cross-tab mechanism designed here has nothing recognition-specific in it, so it belongs there, not inside `services/recognition`.

Browser support: `navigator.locks` (Web Locks API) and `BroadcastChannel` are both Baseline-available since browsers converged around 2022 (Safari 15.4+ shipped both). No feature-detection or fallback is implemented — if either API is unavailable, `subscribe` throws when the first listener is added.

## Scope

**In scope:**

- New `shared/lib/single-tab-connection/` primitive: given a caller-supplied `connect(emit, signal)` function, guarantees only one browser tab actually invokes it at a time, and fans out every emitted event to every subscribed listener in every tab.
- Refactor `services/recognition/api/events.ts` to build `onRecognitionEvent` on top of this primitive instead of its own per-tab listener/reconnect bookkeeping. The exported signature (`onRecognitionEvent(listener): () => void`) does not change.

**Out of scope:**

- `services/recognition/model/use-recognition.ts` and every other consumer — zero changes, they already depend only on `onRecognitionEvent`'s existing signature.
- Backend changes — none needed, this is purely a browser-side connection-sharing concern.
- HTTP/2 / TLS-termination-proxy — separate, infra-level mitigation for the same underlying connection-limit symptom; not part of this change.
- Feature detection or fallback behavior for browsers without `navigator.locks`/`BroadcastChannel`.
- A second SSE consumer — there isn't one yet. The primitive is written generically because the mechanism itself is generic, not because a second consumer is planned.

## Architecture

### `shared/lib/single-tab-connection/`

Mirrors the `event-emitter/` slice's file layout: `single-tab-connection.ts`, `types.ts`, `index.ts`.

```ts
interface SingleTabConnectionOptions<T> {
  name: string; // BroadcastChannel topic name AND Web Locks lock name
  connect: (emit: (event: T) => void, signal: AbortSignal) => Promise<void>;
}

function createSingleTabConnection<T>(
  options: SingleTabConnectionOptions<T>,
): { subscribe(listener: (event: T) => void): () => void };
```

Internals:

- One `BroadcastChannel(name)` per `createSingleTabConnection` call, listened to for the lifetime of the module. Every incoming message is fanned out to all locally-subscribed listeners — this is how non-leader tabs (and the leader's own other subscribers) receive events.
- `subscribe(listener)`: adds `listener` to a local `Set`. When the set goes from empty to non-empty, the tab joins the leader-election queue via `navigator.locks.request(name, { signal }, callback)`, where `signal` comes from a fresh `AbortController` owned by this connection. **Every** tab with at least one active local listener joins this same queue — not just a designated "candidate" — because the queue itself is what makes failover automatic: Web Locks grants the lock to exactly one waiter at a time and re-grants it to the next waiter when the holder releases (including releasing because it was aborted, e.g. its tab closed or its process died). No separate leader-liveness protocol is needed.
- The tab that wins the lock runs `connect(emit, signal)` inside the lock callback. `emit(event)` does two things: `channel.postMessage(event)` (for other tabs — a `BroadcastChannel` does not deliver a tab's own posts back to itself) and a direct synchronous call to this tab's own local listeners (since the leader tab won't receive its own broadcast).
- The returned unsubscribe function removes the listener from the local `Set`; when it becomes empty, `abortController.abort()` is called. If this tab was leader, aborting stops `connect` (via the `signal` it was given) and releases the lock, which the next queued tab picks up. If this tab was still waiting in the queue, aborting simply withdraws its pending request.

### `services/recognition/api/events.ts` refactor

`parseFrame` is unchanged. The manual `Set<Listener>` / `reconnectTimer` / `abortController` module state is deleted — that bookkeeping now lives inside `createSingleTabConnection`. What remains is purely recognition's `connect` implementation:

```ts
async function connect(
  emit: (event: RecognitionSseEvent) => void,
  signal: AbortSignal,
): Promise<void> {
  let reconnectAttempt = 0;

  while (!signal.aborted) {
    try {
      const access = tokenStorage.getAccess();
      const response = await fetch(`${env.apiUrl}/api/v1/recognitions/events`, {
        headers: access ? { Authorization: `Bearer ${access}` } : {},
        signal,
      });

      if (!response.ok || !response.body) {
        throw new Error(`SSE connection failed: ${response.status}`);
      }

      reconnectAttempt = 0;
      // ...same reader/decoder/buffer frame-parsing loop as today, calling emit(event) per parsed frame...
    } catch {
      // network/abort — ignored, falls through to backoff below
    }

    if (signal.aborted) return;

    const delay = Math.min(1000 * 2 ** reconnectAttempt, 30_000);
    reconnectAttempt += 1;
    await sleep(delay, signal); // resolves early if aborted mid-wait, instead of idling out a stale timer
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

`sleep(delay, signal)` is a small local helper (`new Promise` + `setTimeout`, rejecting/resolving early on the signal's `abort` event) so that a tab which just lost its last listener mid-backoff doesn't keep the lock/connection alive for up to 30s longer than necessary.

Bearer token handling is unchanged — `tokenStorage.getAccess()` is still read fresh on every connection attempt inside `connect`, so token refreshes across reconnects keep working exactly as today.

Both files keep the codebase's existing WHY-only comment style (as seen today in `events.ts`, e.g. why a manual `fetch` is used instead of `EventSource`, why backoff is exponential). `single-tab-connection.ts` gets the same treatment for its own non-obvious bits — e.g. why every tab with a listener joins the lock queue instead of only a designated leader, and why `emit` both posts to the channel and calls local listeners directly.

## Data Flow

1. First `onRecognitionEvent` listener anywhere in a tab → tab's local set goes 0→1 → tab requests the `recognition-events` lock.
2. Exactly one tab (in this browser, across all open tabs of the app) holds the lock at a time and runs `connect`; every other tab with active listeners sits queued.
3. Each parsed SSE frame → `emit` → `BroadcastChannel` post + direct call to the leader tab's own listeners → every subscribed listener in every tab (via its own `channel.onmessage`) receives the event.
4. A tab's last listener unsubscribes → its `AbortController` aborts → if it was leader, `connect`'s fetch aborts and the lock releases; if it was queued, it's simply removed from the queue.
5. Lock release (case 4, or the leader tab/process dying outright) → next queued tab (if any) is granted the lock and starts its own `connect` call — a fresh SSE connection with its own fresh backoff state. Events from before this handoff are not replayed; this matches today's single-tab behavior, where closing your only tab mid-stream already loses anything in flight.

## Error Handling

- `connect` throwing/rejecting (not just returning) still releases the Web Locks lock — Web Locks releases on settle regardless of resolve vs. reject — so a hard failure in `connect` still hands leadership to the next queued tab rather than wedging the lock forever.
- Reconnect/backoff policy (exponential, 1s → 30s cap) is unchanged from today and stays entirely inside recognition's own `connect`; the primitive has no opinion on retry behavior.
- If `BroadcastChannel` is unavailable, construction throws at module load (`createSingleTabConnection` runs eagerly at the top of `events.ts`). If `navigator.locks` is unavailable, the error instead surfaces later, synchronously, from the first `subscribe` call. Neither is caught — no fallback, per the Scope section's explicit decision.

## Testing / Verification

No automated test runner in this project. `bun run build` + `bun run lint`, plus a manual browser walkthrough: open 2+ tabs on an item's create-recognition flow, trigger a recognition in one tab, confirm (via DevTools → Network) only one `recognitions/events` connection exists across all tabs, confirm the event (ready/failed) is observed in every tab, then close the tab currently holding the connection mid-recognition and confirm a remaining tab picks up leadership (new `recognitions/events` request appears in its Network panel) and continues receiving events for subsequent recognitions.
