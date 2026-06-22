# Frontend Stack Infrastructure — Design

**Date:** 2026-06-22
**Scope:** A — stack infrastructure only (no features)
**Status:** Approved (pending spec review)

## Context

The `fe/` app is a fresh Vite + React 19 (+ React Compiler) project, already restructured into the project's layered architecture (`app → pages → features → services → kernel → shared`, import direction downward only; see `fe/CLAUDE.md`). The layers are empty scaffolds.

This design wires the chosen stack into those layers so feature work can begin. It builds **infrastructure only** — providers, router skeleton, data/auth client, styling, form conventions. No user-facing feature (including login UI) is built here.

### Chosen stack (fixed)

- **Styling:** Tailwind CSS + HeroUI
- **Server state:** TanStack Query
- **Routing:** TanStack Router (code-based)
- **Forms:** TanStack Form (+ zod via Standard Schema)
- **API types:** generated from the backend OpenAPI spec

### Forward constraint: WebView / mobile

The frontend will later be embedded in a native WebView to ship as a mobile app. The native shell (Capacitor / RN-WebView / bare) is **out of scope** for this design, but the following choices are made now so they don't need retrofitting:

- Token persistence sits behind a `TokenStorage` interface — swap the localStorage adapter for a native-bridge adapter later, in one place.
- Router uses browser history (works in a WebView served from an origin); hash mode is the documented fallback for `file://`-loaded shells.
- Styling is mobile-first with safe-area handling (`viewport-fit=cover`, safe-area CSS vars) for device notches.

## Decisions

| # | Decision | Rationale |
|---|----------|-----------|
| 1 | Scope = infrastructure only | Build the foundation; features come in later, separately scoped designs. |
| 2 | Code-based routing (not file-based) | Respects the layer split — `app/routes` owns the route tree, `pages/` owns screens. File-based routing imposes its own folder convention and blurs that boundary. |
| 3 | Full data/auth infra now | An HTTP client with auth + `401 → refresh` and a swappable token store are infrastructure, not a feature; Query is useless without them. |
| 4 | OpenAPI → types-only + thin owned client | `openapi-typescript` emits pure types (always in sync); we own the `openapi-fetch` client so auth/401/token-storage inject cleanly as middleware; `openapi-react-query` provides the TanStack Query layer. Generated artifact stays pure types and never fights the hand-written auth client. |

## Layer placement

Import direction is downward only.

| Layer | Contents |
|-------|----------|
| **app/app.tsx** | Entry: wraps providers around `RouterProvider`, mounts to the DOM. |
| **app/providers/** | `AppProviders` composing `QueryClientProvider` + `HeroUIProvider` (+ theme). One file per provider plus a barrel. |
| **app/routes/** | Code-based route tree: `rootRoute`, route definitions, `createRouter`, exported `router`. Each route's `component` lazy-imports a page from `pages/`. |
| **app/styles/** | Tailwind entry CSS + HeroUI, global base, safe-area CSS variables. |
| **app/layouts/** | App shell layout(s) rendered by the root route around `<Outlet/>`. |
| **shared/api/** | `schema.ts` (OpenAPI-generated types, committed) · `client.ts` (`openapi-fetch` + middleware) · `$api` (`openapi-react-query`) · `query-client.ts` (`QueryClient` + defaults). |
| **shared/auth/** | `TokenStorage` port + `localStorageTokenStorage` adapter — the WebView swap point. |
| **shared/config/** | Typed env access (`VITE_API_URL`) and runtime config. |
| **shared/ui/** | HeroUI re-exports / wrapped primitives — single ui-kit choke point. |
| **shared/lib/** | Small library extensions (`cn` classnames helper, form helpers). |
| **kernel/** | Empty for now. Session glue (current-auth state built on `TokenStorage` + a `/me` query) lands here when the auth feature arrives. |
| **pages / features / services** | Empty. Conventions documented, no code yet. |

## Data flow

A query, end to end:

```
feature: $api.useQuery('get', '/items', { params })
  → openapi-react-query → openapi-fetch client
    → onRequest middleware: attach Authorization: Bearer <access from TokenStorage>
    → fetch (VITE_API_URL + path)
    → on 401: single-flight refresh (POST /auth/refresh with refresh token)
        success → store new tokens → retry original request
        failure → clear tokens → redirect to login route
  → typed response (from generated schema) → Query cache
```

Request and response types come entirely from the OpenAPI schema; none are hand-written.

## Auth & token plumbing

The WebView-relevant core.

`TokenStorage` interface:

```ts
interface TokenStorage {
  getAccess(): string | null
  getRefresh(): string | null
  setTokens(access: string, refresh: string): void
  clear(): void
}
```

- **Now:** `localStorageTokenStorage` implements it.
- **Later (WebView):** a native-bridge adapter implements the same interface; swapped in one place (provider/config). Features never change.
- **401 refresh is single-flight:** concurrent 401s share one in-flight refresh to avoid a refresh stampede; all wait, then retry.
- Login UI is a feature and is deferred. The refresh + redirect-on-failure plumbing exists now, and `login` is a placeholder route in the tree.

## Routing

- Code-based tree in `app/routes`; `createRouter({ routeTree })`.
- History: browser history by default (WebView via served origin). Hash mode is documented as the fallback for `file://`-loaded shells.
- The root route renders the app shell (`app/layouts`) plus `<Outlet/>`. Routes lazy-load page components from `pages/`.
- A `beforeLoad`-based guard pattern (checks session) is established for protected routes; the protected routes themselves ship with their features.
- A router error boundary lives in the shell for route-level errors.

## Styling, forms, config, codegen

- **Styling:** Tailwind v4 (CSS-first) + HeroUI. HeroUI plugin configured in `app/styles`, `HeroUIProvider` in `app/providers`, `cn` helper in `shared/lib`. Mobile-first; `viewport-fit=cover` meta in `index.html` and safe-area CSS variables for notches. Compatible Tailwind/HeroUI versions are pinned at install per HeroUI's current Tailwind v4 install guide.
- **Forms:** TanStack Form with zod validation (via Standard Schema). Convention: a form lives in the feature that owns it. No forms are built here — only the dependency and the convention.
- **Config:** `VITE_API_URL` (with `.env` / `.env.example`); `shared/config` exposes typed config. WebView builds may inject/hardcode the API origin.
- **Codegen:** a script fetches `openapi.json` from the backend (`/swagger-json`), commits it, and runs `openapi-typescript` to emit `shared/api/schema.ts`. Reproducible — the backend does not need to run at build time. A documented npm script regenerates after API changes.

## Deliverables (scope A)

1. Install: `tailwindcss`, HeroUI, `@tanstack/{react-query,react-router,react-form}`, `openapi-typescript`, `openapi-fetch`, `openapi-react-query`, `zod`.
2. Tailwind + HeroUI setup (config, `app/styles`, provider).
3. `QueryClient` + provider with sensible defaults.
4. Code-based router skeleton (root + index + login placeholder) + `RouterProvider` in `app/app.tsx`.
5. OpenAPI codegen script → `shared/api/schema.ts`.
6. `openapi-fetch` client + auth/401 middleware + `openapi-react-query` `$api`.
7. `TokenStorage` port + `localStorage` adapter.
8. `shared/config` env, `shared/lib` `cn`, `shared/ui` barrel.
9. Update `fe/CLAUDE.md` (stack, conventions, codegen command).
10. Build green (`tsc -b && vite build`).

## Error handling

- Query-level defaults on the `QueryClient` (retry policy, error states surfaced per feature).
- `401` handled centrally in the client middleware (refresh / redirect).
- Network and unexpected errors surfaced through Query error states in features.
- A top-level router error boundary in the shell catches route-level errors.

## Testing

Scope A is infrastructure; the gate is `tsc -b && vite build` (type-check + bundle). Unit tests arrive with features. Optionally, a smoke test asserting the app renders and providers mount. Kept light intentionally.

## Out of scope

- The native WebView shell and its bridge (camera, secure storage, hardware back) — a later, separately scoped design.
- Any user-facing feature, including the login flow / auth UI.
- Frontend lint enforcement of layer boundaries (`eslint-plugin-boundaries` / `steiger`) — optional, separate.
