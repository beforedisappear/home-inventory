# Frontend Stack Infrastructure Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Wire the chosen stack (Tailwind v4 + HeroUI, TanStack Query/Router/Form, OpenAPI-typed client) into the existing layered `fe/` architecture so feature work can begin.

**Architecture:** Each stack piece lands in its correct layer (import direction downward only): providers/router/styles in `app/`, the data+auth client and primitives in `shared/`. The HTTP client is owned by us (auth header + single-flight `401→refresh→retry`); only OpenAPI **types** are generated. Token persistence sits behind a `TokenStorage` interface so a native WebView adapter can swap in later.

**Tech Stack:** React 19 + React Compiler, Vite 8, TypeScript 6 (bundler), Bun, Tailwind CSS v4 + HeroUI v3, TanStack Query/Router/Form, openapi-typescript + openapi-fetch + openapi-react-query, zod, Vitest + Testing Library.

## Global Constraints

- Package manager is **Bun** — all installs/scripts via `bun` / `bun run`.
- **React Compiler is enabled** — write idiomatic pure React; do NOT hand-write `useMemo`/`useCallback`/`React.memo`.
- **`verbatimModuleSyntax`** — import types with `import type`.
- **`erasableSyntaxOnly`** — no runtime `enum`/`namespace`; use `const` objects + union types.
- **Import direction is downward only** (`app → pages → features → services → kernel → shared`); no same-layer cross-import in pages/features/services.
- **Public API per slice** — import from a slice's `index.ts`, never its internals.
- **Path alias** `@/*` → `src/*` is configured; use it for cross-layer imports.
- **Commits:** Conventional Commits; do NOT add a `Co-Authored-By` trailer or any AI attribution.
- API base origin for local dev: `http://localhost:3000`; backend routes are under `/api/v1` (global prefix `api` + URI version `1`).

---

### Task 1: Dependencies + Tailwind v4 + HeroUI styling foundation

**Files:**
- Modify: `fe/package.json` (dependencies)
- Modify: `fe/vite.config.ts`
- Modify: `fe/src/app/styles/index.css`
- Modify: `fe/index.html:6`

**Interfaces:**
- Produces: a building app with Tailwind v4 utilities + HeroUI v3 styles available; `@tailwindcss/vite` plugin active.

- [ ] **Step 1: Install runtime dependencies**

```bash
cd fe
bun add @heroui/styles @heroui/react @tanstack/react-query @tanstack/react-router @tanstack/react-form zod openapi-fetch openapi-react-query clsx tailwind-merge
```

- [ ] **Step 2: Install dev dependencies**

```bash
cd fe
bun add -d tailwindcss @tailwindcss/vite openapi-typescript vitest jsdom @testing-library/react @testing-library/jest-dom
```

- [ ] **Step 3: Add the Tailwind Vite plugin**

Replace `fe/vite.config.ts` with:

```ts
import { fileURLToPath, URL } from 'node:url'
import { defineConfig } from 'vite'
import react, { reactCompilerPreset } from '@vitejs/plugin-react'
import babel from '@rolldown/plugin-babel'
import tailwindcss from '@tailwindcss/vite'

// https://vite.dev/config/
export default defineConfig({
  plugins: [
    react(),
    babel({ presets: [reactCompilerPreset()] }),
    tailwindcss(),
  ],
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
```

- [ ] **Step 4: Set up global CSS (order matters: tailwind before HeroUI)**

Replace `fe/src/app/styles/index.css` with:

```css
@import "tailwindcss";
@import "@heroui/styles";

:root {
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
}

html,
body,
#root {
  height: 100%;
}

body {
  margin: 0;
}
```

- [ ] **Step 5: Enable safe-area viewport for WebView notches**

In `fe/index.html`, replace the viewport meta tag (line 6) with:

```html
    <meta name="viewport" content="width=device-width, initial-scale=1.0, viewport-fit=cover" />
```

- [ ] **Step 6: Verify the build is green**

Run: `cd fe && bun run build`
Expected: `tsc -b` passes and `vite build` prints `✓ built in …` with a CSS asset emitted.

- [ ] **Step 7: Commit**

```bash
cd fe && git add package.json bun.lock vite.config.ts src/app/styles/index.css index.html
git commit -m "feat(fe): add stack deps and Tailwind v4 + HeroUI styling foundation"
```

---

### Task 2: Typed env config + `cn` helper + Vitest setup

**Files:**
- Create: `fe/src/shared/config/config.ts`
- Create: `fe/src/shared/config/env.d.ts`
- Create: `fe/src/shared/config/index.ts`
- Create: `fe/src/shared/lib/cn.ts`
- Create: `fe/src/shared/lib/cn.test.ts`
- Create: `fe/src/shared/lib/index.ts`
- Create: `fe/.env`, `fe/.env.example`
- Create: `fe/vitest.config.ts`, `fe/vitest.setup.ts`
- Modify: `fe/package.json` (test scripts)
- Delete: `fe/src/shared/lib/.gitkeep`, `fe/src/shared/config/.gitkeep`

**Interfaces:**
- Produces: `appConfig: { apiUrl: string }` from `@/shared/config`; `cn(...inputs: ClassValue[]): string` from `@/shared/lib`; a working Vitest runner.

- [ ] **Step 1: Add Vitest config**

Create `fe/vitest.config.ts`:

```ts
import { fileURLToPath, URL } from 'node:url'
import react from '@vitejs/plugin-react'
import { defineConfig } from 'vitest/config'

export default defineConfig({
  plugins: [react()],
  test: {
    environment: 'jsdom',
    globals: true,
    setupFiles: ['./vitest.setup.ts'],
  },
  resolve: {
    alias: {
      '@': fileURLToPath(new URL('./src', import.meta.url)),
    },
  },
})
```

Create `fe/vitest.setup.ts`:

```ts
import '@testing-library/jest-dom'
```

- [ ] **Step 2: Add test scripts**

In `fe/package.json`, add to `scripts`:

```json
    "test": "vitest run",
    "test:watch": "vitest"
```

- [ ] **Step 3: Write the failing `cn` test**

Create `fe/src/shared/lib/cn.test.ts`:

```ts
import { describe, expect, it } from 'vitest'

import { cn } from './cn'

describe('cn', () => {
  it('joins class names', () => {
    expect(cn('p-2', 'text-sm')).toBe('p-2 text-sm')
  })

  it('resolves conflicting tailwind classes (last wins)', () => {
    expect(cn('p-2', 'p-4')).toBe('p-4')
  })

  it('skips falsy values', () => {
    expect(cn('p-2', false, null, undefined, 'm-1')).toBe('p-2 m-1')
  })
})
```

- [ ] **Step 4: Run the test to verify it fails**

Run: `cd fe && bun run test cn`
Expected: FAIL — cannot resolve `./cn`.

- [ ] **Step 5: Implement `cn`**

Create `fe/src/shared/lib/cn.ts`:

```ts
import { clsx, type ClassValue } from 'clsx'
import { twMerge } from 'tailwind-merge'

export function cn(...inputs: ClassValue[]): string {
  return twMerge(clsx(inputs))
}
```

Create `fe/src/shared/lib/index.ts`:

```ts
export { cn } from './cn'
```

- [ ] **Step 6: Run the test to verify it passes**

Run: `cd fe && bun run test cn`
Expected: PASS (3 tests).

- [ ] **Step 7: Add typed env + config**

Create `fe/src/shared/config/env.d.ts`:

```ts
interface ImportMetaEnv {
  readonly VITE_API_URL: string
}

interface ImportMeta {
  readonly env: ImportMetaEnv
}
```

Create `fe/src/shared/config/config.ts`:

```ts
interface AppConfig {
  apiUrl: string
}

export const appConfig: AppConfig = {
  apiUrl: import.meta.env.VITE_API_URL ?? 'http://localhost:3000',
}
```

Create `fe/src/shared/config/index.ts`:

```ts
export { appConfig } from './config'
```

- [ ] **Step 8: Add env files**

Create `fe/.env` and `fe/.env.example`, both with:

```
VITE_API_URL=http://localhost:3000
```

- [ ] **Step 9: Remove now-populated gitkeeps and verify build**

```bash
cd fe && git rm -q src/shared/lib/.gitkeep src/shared/config/.gitkeep
bun run build
```
Expected: build green.

- [ ] **Step 10: Commit**

```bash
cd fe && git add -A src/shared/config src/shared/lib vitest.config.ts vitest.setup.ts package.json bun.lock .env.example
git add .env 2>/dev/null || true
git commit -m "feat(fe): add typed env config, cn helper, vitest setup"
```

Note: `.env` is gitignored by the Vite template; only `.env.example` is committed.

---

### Task 3: `TokenStorage` port + localStorage adapter

**Files:**
- Create: `fe/src/shared/auth/token-storage.ts`
- Create: `fe/src/shared/auth/token-storage.test.ts`
- Create: `fe/src/shared/auth/index.ts`

**Interfaces:**
- Produces:
  - `interface TokenStorage { getAccess(): string | null; getRefresh(): string | null; setTokens(access: string, refresh: string): void; clear(): void }`
  - `tokenStorage: TokenStorage` (singleton, localStorage-backed) from `@/shared/auth`.

- [ ] **Step 1: Write the failing test**

Create `fe/src/shared/auth/token-storage.test.ts`:

```ts
import { beforeEach, describe, expect, it } from 'vitest'

import { tokenStorage } from './token-storage'

describe('tokenStorage (localStorage adapter)', () => {
  beforeEach(() => localStorage.clear())

  it('returns null when empty', () => {
    expect(tokenStorage.getAccess()).toBeNull()
    expect(tokenStorage.getRefresh()).toBeNull()
  })

  it('stores and reads a token pair', () => {
    tokenStorage.setTokens('a1', 'r1')
    expect(tokenStorage.getAccess()).toBe('a1')
    expect(tokenStorage.getRefresh()).toBe('r1')
  })

  it('clear() removes both tokens', () => {
    tokenStorage.setTokens('a1', 'r1')
    tokenStorage.clear()
    expect(tokenStorage.getAccess()).toBeNull()
    expect(tokenStorage.getRefresh()).toBeNull()
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd fe && bun run test token-storage`
Expected: FAIL — cannot resolve `./token-storage`.

- [ ] **Step 3: Implement the port + adapter**

Create `fe/src/shared/auth/token-storage.ts`:

```ts
export interface TokenStorage {
  getAccess(): string | null
  getRefresh(): string | null
  setTokens(access: string, refresh: string): void
  clear(): void
}

const ACCESS_KEY = 'hi.access'
const REFRESH_KEY = 'hi.refresh'

export const localStorageTokenStorage: TokenStorage = {
  getAccess: () => localStorage.getItem(ACCESS_KEY),
  getRefresh: () => localStorage.getItem(REFRESH_KEY),
  setTokens: (access, refresh) => {
    localStorage.setItem(ACCESS_KEY, access)
    localStorage.setItem(REFRESH_KEY, refresh)
  },
  clear: () => {
    localStorage.removeItem(ACCESS_KEY)
    localStorage.removeItem(REFRESH_KEY)
  },
}

// единая точка свапа: в WebView подменим на нативный адаптер того же интерфейса
export const tokenStorage: TokenStorage = localStorageTokenStorage
```

Create `fe/src/shared/auth/index.ts`:

```ts
export { tokenStorage } from './token-storage'
export type { TokenStorage } from './token-storage'
```

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd fe && bun run test token-storage`
Expected: PASS (3 tests).

- [ ] **Step 5: Commit**

```bash
cd fe && git add src/shared/auth
git commit -m "feat(fe): add TokenStorage port with localStorage adapter"
```

---

### Task 4: OpenAPI type generation

**Files:**
- Create: `fe/src/shared/api/openapi.json` (fetched, committed)
- Create: `fe/src/shared/api/schema.ts` (generated)
- Modify: `fe/package.json` (codegen scripts)

**Interfaces:**
- Produces: `paths` type export from `@/shared/api/schema` covering all backend endpoints.

**Prerequisite:** the backend must be running. In a separate terminal: `cd be && docker compose up -d && bun run start:dev` (or `npm run start:dev`). Confirm `http://localhost:3000/openapi.json` returns JSON before continuing.

- [ ] **Step 1: Add codegen scripts**

In `fe/package.json`, add to `scripts`:

```json
    "api:fetch": "curl -fsS ${VITE_API_URL:-http://localhost:3000}/openapi.json -o src/shared/api/openapi.json",
    "api:gen": "openapi-typescript src/shared/api/openapi.json -o src/shared/api/schema.ts",
    "api:sync": "bun run api:fetch && bun run api:gen"
```

- [ ] **Step 2: Generate the spec + types**

Run: `cd fe && bun run api:sync`
Expected: `src/shared/api/openapi.json` written, then openapi-typescript prints `🚀 … wrote … src/shared/api/schema.ts`.

- [ ] **Step 3: Confirm the path prefix and types compile**

Run: `cd fe && grep -m1 '"/api/v1/' src/shared/api/schema.ts && bun run build`
Expected: the grep prints a path key like `"/api/v1/items"` (confirms `baseUrl` = origin is correct — keep `VITE_API_URL=http://localhost:3000`). Build is green.

If the grep prints nothing (paths are bare like `"/items"`), set `VITE_API_URL=http://localhost:3000/api/v1` in both `.env` and `.env.example` instead, then re-run the build.

- [ ] **Step 4: Commit**

```bash
cd fe && git add src/shared/api/openapi.json src/shared/api/schema.ts package.json
git commit -m "feat(fe): generate OpenAPI types from backend spec"
```

---

### Task 5: Owned HTTP client + single-flight 401 refresh + `$api`

**Files:**
- Create: `fe/src/shared/api/refresh.ts`
- Create: `fe/src/shared/api/refresh.test.ts`
- Create: `fe/src/shared/api/client.ts`
- Create: `fe/src/shared/api/index.ts`

**Interfaces:**
- Consumes: `appConfig` (`@/shared/config`), `tokenStorage` (`@/shared/auth`), `paths` (`./schema`).
- Produces:
  - `refreshOnce(): Promise<boolean>` from `./refresh` (single-flight token refresh).
  - `apiClient` (openapi-fetch client) and `$api` (openapi-react-query) from `@/shared/api`.

- [ ] **Step 1: Write the failing single-flight refresh test**

Create `fe/src/shared/api/refresh.test.ts`:

```ts
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest'

import { tokenStorage } from '@/shared/auth'

import { refreshOnce } from './refresh'

describe('refreshOnce (single-flight)', () => {
  beforeEach(() => {
    localStorage.clear()
    tokenStorage.setTokens('old-a', 'old-r')
  })
  afterEach(() => vi.restoreAllMocks())

  it('dedupes concurrent refreshes into one HTTP call and stores new tokens', async () => {
    const fetchMock = vi.fn().mockResolvedValue(
      new Response(
        JSON.stringify({ accessToken: 'new-a', refreshToken: 'new-r' }),
        { status: 200 },
      ),
    )
    vi.stubGlobal('fetch', fetchMock)

    const [a, b] = await Promise.all([refreshOnce(), refreshOnce()])

    expect(a).toBe(true)
    expect(b).toBe(true)
    expect(fetchMock).toHaveBeenCalledTimes(1)
    expect(tokenStorage.getAccess()).toBe('new-a')
    expect(tokenStorage.getRefresh()).toBe('new-r')
  })

  it('returns false when there is no refresh token', async () => {
    tokenStorage.clear()
    const fetchMock = vi.fn()
    vi.stubGlobal('fetch', fetchMock)

    expect(await refreshOnce()).toBe(false)
    expect(fetchMock).not.toHaveBeenCalled()
  })

  it('returns false when the refresh request fails', async () => {
    vi.stubGlobal('fetch', vi.fn().mockResolvedValue(new Response(null, { status: 401 })))
    expect(await refreshOnce()).toBe(false)
  })
})
```

- [ ] **Step 2: Run the test to verify it fails**

Run: `cd fe && bun run test refresh`
Expected: FAIL — cannot resolve `./refresh`.

- [ ] **Step 3: Implement single-flight refresh**

Create `fe/src/shared/api/refresh.ts`:

```ts
import { tokenStorage } from '@/shared/auth'
import { appConfig } from '@/shared/config'

let inFlight: Promise<boolean> | null = null

async function doRefresh(): Promise<boolean> {
  const refreshToken = tokenStorage.getRefresh()
  if (!refreshToken) return false

  const res = await fetch(`${appConfig.apiUrl}/api/v1/auth/refresh`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ refreshToken }),
  })
  if (!res.ok) return false

  const data = (await res.json()) as { accessToken: string; refreshToken: string }
  tokenStorage.setTokens(data.accessToken, data.refreshToken)
  return true
}

// single-flight: конкурентные 401 делят один HTTP-refresh, без штампеды
export function refreshOnce(): Promise<boolean> {
  inFlight ??= doRefresh().finally(() => {
    inFlight = null
  })
  return inFlight
}
```

If Task 4 Step 3 changed `VITE_API_URL` to include `/api/v1`, change the fetch URL here to `${appConfig.apiUrl}/auth/refresh`.

- [ ] **Step 4: Run the test to verify it passes**

Run: `cd fe && bun run test refresh`
Expected: PASS (3 tests).

- [ ] **Step 5: Implement the client with auth + retry middleware**

Create `fe/src/shared/api/client.ts`:

```ts
import createFetchClient, { type Middleware } from 'openapi-fetch'
import createQueryHooks from 'openapi-react-query'

import { tokenStorage } from '@/shared/auth'
import { appConfig } from '@/shared/config'

import { refreshOnce } from './refresh'
import type { paths } from './schema'

// клон запроса (с телом) до отправки — чтобы повторить после refresh
const originals = new WeakMap<Request, Request>()

const authMiddleware: Middleware = {
  onRequest({ request }) {
    const access = tokenStorage.getAccess()
    if (access) request.headers.set('Authorization', `Bearer ${access}`)
    originals.set(request, request.clone())
    return request
  },
  async onResponse({ request, response }) {
    const original = originals.get(request)
    originals.delete(request)

    if (response.status !== 401 || !original) return response

    const refreshed = await refreshOnce()
    if (!refreshed) {
      tokenStorage.clear()
      window.location.assign('/login')
      return response
    }

    const retry = original.clone()
    const access = tokenStorage.getAccess()
    if (access) retry.headers.set('Authorization', `Bearer ${access}`)
    return fetch(retry)
  },
}

export const apiClient = createFetchClient<paths>({ baseUrl: appConfig.apiUrl })
apiClient.use(authMiddleware)

export const $api = createQueryHooks(apiClient)
```

Create `fe/src/shared/api/index.ts`:

```ts
export { $api, apiClient } from './client'
```

- [ ] **Step 6: Verify the full suite + build**

Run: `cd fe && bun run test && bun run build`
Expected: all tests pass; build green.

- [ ] **Step 7: Commit**

```bash
cd fe && git add src/shared/api/refresh.ts src/shared/api/refresh.test.ts src/shared/api/client.ts src/shared/api/index.ts
git commit -m "feat(fe): add owned API client with single-flight 401 refresh"
```

---

### Task 6: QueryClient + app providers + shared/ui barrel

**Files:**
- Create: `fe/src/shared/api/query-client.ts`
- Modify: `fe/src/shared/api/index.ts`
- Create: `fe/src/app/providers/app-providers.tsx`
- Create: `fe/src/app/providers/index.ts`
- Create: `fe/src/shared/ui/index.ts`
- Delete: `fe/src/shared/ui/.gitkeep`, `fe/src/app/providers/.gitkeep`

**Interfaces:**
- Consumes: nothing new beyond `@tanstack/react-query`, `@heroui/react`.
- Produces: `queryClient` from `@/shared/api`; `AppProviders` component from `@/app/providers`; HeroUI primitive re-exports from `@/shared/ui`.

- [ ] **Step 1: Add the QueryClient**

Create `fe/src/shared/api/query-client.ts`:

```ts
import { QueryClient } from '@tanstack/react-query'

export const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      retry: 1,
      refetchOnWindowFocus: false,
    },
  },
})
```

Append to `fe/src/shared/api/index.ts`:

```ts
export { queryClient } from './query-client'
```

- [ ] **Step 2: Add the providers composition**

Create `fe/src/app/providers/app-providers.tsx`:

```tsx
import type { ReactNode } from 'react'

import { HeroUIProvider } from '@heroui/react'
import { QueryClientProvider } from '@tanstack/react-query'

import { queryClient } from '@/shared/api'

export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <HeroUIProvider>{children}</HeroUIProvider>
    </QueryClientProvider>
  )
}
```

Create `fe/src/app/providers/index.ts`:

```ts
export { AppProviders } from './app-providers'
```

- [ ] **Step 3: Add the shared ui-kit barrel**

Create `fe/src/shared/ui/index.ts`:

```ts
// единая точка ui-kit: фичи берут компоненты отсюда, не из @heroui/react напрямую
export { Button, Input, Spinner } from '@heroui/react'
```

- [ ] **Step 4: Remove gitkeeps and verify build**

```bash
cd fe && git rm -q src/shared/ui/.gitkeep src/app/providers/.gitkeep
bun run build
```
Expected: build green.

- [ ] **Step 5: Commit**

```bash
cd fe && git add src/shared/api/query-client.ts src/shared/api/index.ts src/app/providers src/shared/ui
git commit -m "feat(fe): add QueryClient, app providers, shared ui-kit barrel"
```

---

### Task 7: Code-based router skeleton + layout + page placeholders

**Files:**
- Create: `fe/src/pages/home/ui/home-page.tsx`, `fe/src/pages/home/index.ts`
- Create: `fe/src/pages/login/ui/login-page.tsx`, `fe/src/pages/login/index.ts`
- Create: `fe/src/app/layouts/root-layout.tsx`, `fe/src/app/layouts/index.ts`
- Create: `fe/src/app/routes/root-route.tsx`
- Create: `fe/src/app/routes/router.tsx`
- Create: `fe/src/app/routes/index.ts`
- Delete: `fe/src/pages/.gitkeep`, `fe/src/app/routes/.gitkeep`, `fe/src/app/layouts/.gitkeep`

**Interfaces:**
- Consumes: nothing new beyond `@tanstack/react-router`.
- Produces:
  - `HomePage`, `LoginPage` components from `@/pages/home` and `@/pages/login`.
  - `RootLayout` from `@/app/layouts`.
  - `router` (a configured `createRouter` instance) from `@/app/routes`, with `@tanstack/react-router` `Register` augmented to `typeof router`.

- [ ] **Step 1: Add placeholder pages**

Create `fe/src/pages/home/ui/home-page.tsx`:

```tsx
export function HomePage() {
  return <h1 className="p-4 text-2xl font-bold">Home Inventory</h1>
}
```

Create `fe/src/pages/home/index.ts`:

```ts
export { HomePage } from './ui/home-page'
```

Create `fe/src/pages/login/ui/login-page.tsx`:

```tsx
export function LoginPage() {
  return <h1 className="p-4 text-2xl font-bold">Login</h1>
}
```

Create `fe/src/pages/login/index.ts`:

```ts
export { LoginPage } from './ui/login-page'
```

- [ ] **Step 2: Add the root layout (app shell + Outlet)**

Create `fe/src/app/layouts/root-layout.tsx`:

```tsx
import { Outlet } from '@tanstack/react-router'

export function RootLayout() {
  return (
    <div className="min-h-full">
      <Outlet />
    </div>
  )
}
```

Create `fe/src/app/layouts/index.ts`:

```ts
export { RootLayout } from './root-layout'
```

- [ ] **Step 3: Add the root route**

Create `fe/src/app/routes/root-route.tsx`:

```tsx
import { createRootRoute } from '@tanstack/react-router'

import { RootLayout } from '@/app/layouts'

export const rootRoute = createRootRoute({
  component: RootLayout,
})
```

- [ ] **Step 4: Build the route tree + router**

Create `fe/src/app/routes/router.tsx`:

```tsx
import { createRoute, createRouter } from '@tanstack/react-router'

import { HomePage } from '@/pages/home'
import { LoginPage } from '@/pages/login'

import { rootRoute } from './root-route'

const indexRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/',
  component: HomePage,
})

const loginRoute = createRoute({
  getParentRoute: () => rootRoute,
  path: '/login',
  component: LoginPage,
})

const routeTree = rootRoute.addChildren([indexRoute, loginRoute])

export const router = createRouter({ routeTree })

declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router
  }
}
```

Create `fe/src/app/routes/index.ts`:

```ts
export { router } from './router'
```

Note: real feature pages should be lazy-loaded (`component: () => import(...)` via `createLazyRoute`) as they grow; these two placeholders stay eager.

- [ ] **Step 5: Remove gitkeeps and verify build**

```bash
cd fe && git rm -q src/pages/.gitkeep src/app/routes/.gitkeep src/app/layouts/.gitkeep
bun run build
```
Expected: build green (router type registration compiles).

- [ ] **Step 6: Commit**

```bash
cd fe && git add src/pages/home src/pages/login src/app/layouts src/app/routes
git commit -m "feat(fe): add code-based router skeleton with layout and page placeholders"
```

---

### Task 8: Wire entry, smoke test, update CLAUDE.md

**Files:**
- Modify: `fe/src/app/app.tsx`
- Create: `fe/src/app/app.smoke.test.tsx`
- Modify: `fe/CLAUDE.md`

**Interfaces:**
- Consumes: `AppProviders` (`@/app/providers`), `router` (`@/app/routes`), `HomePage` (`@/pages/home`).
- Produces: the mounted application (providers wrapping `RouterProvider`).

- [ ] **Step 1: Wire the entry**

Replace `fe/src/app/app.tsx` with:

```tsx
import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'

import { RouterProvider } from '@tanstack/react-router'

import { AppProviders } from '@/app/providers'
import { router } from '@/app/routes'
import '@/app/styles/index.css'

createRoot(document.getElementById('root')!).render(
  <StrictMode>
    <AppProviders>
      <RouterProvider router={router} />
    </AppProviders>
  </StrictMode>,
)
```

- [ ] **Step 2: Write the smoke test**

Create `fe/src/app/app.smoke.test.tsx`:

```tsx
import { render, screen } from '@testing-library/react'
import { describe, expect, it } from 'vitest'

import { AppProviders } from '@/app/providers'
import { HomePage } from '@/pages/home'

describe('app smoke', () => {
  it('renders the home page inside the providers', () => {
    render(
      <AppProviders>
        <HomePage />
      </AppProviders>,
    )
    expect(screen.getByRole('heading', { name: 'Home Inventory' })).toBeInTheDocument()
  })
})
```

- [ ] **Step 3: Run the smoke test**

Run: `cd fe && bun run test app.smoke`
Expected: PASS (1 test).

- [ ] **Step 4: Update CLAUDE.md stack + conventions**

In `fe/CLAUDE.md`, update the `## Stack` table to add rows and replace the "not chosen yet" paragraph with the resolved stack, then add a `## Data & API` section documenting:
- Server state via TanStack Query; typed client in `shared/api` (`$api` from `openapi-react-query`); regenerate types with `bun run api:sync` (backend must be running).
- Auth: access token attached + single-flight `401 → refresh → retry` in the client middleware; tokens behind `TokenStorage` (`shared/auth`) — swap the adapter for WebView later.
- Routing: code-based in `app/routes`; pages live in `pages/`.
- Forms: TanStack Form + zod, co-located in the owning feature.
- UI: import HeroUI primitives via `@/shared/ui`, not `@heroui/react` directly.

Also update the `app/app.tsx` bullet to: "application entry — mounts `AppProviders` wrapping `RouterProvider`; imports global styles. No separate `main.tsx`."

- [ ] **Step 5: Final verification**

Run: `cd fe && bun run test && bun run build`
Expected: all tests pass; build green.

- [ ] **Step 6: Commit**

```bash
cd fe && git add src/app/app.tsx src/app/app.smoke.test.tsx CLAUDE.md
git commit -m "feat(fe): wire providers + router entry, smoke test, update CLAUDE.md"
```

---

## Self-Review

**Spec coverage:**
- Layer placement (spec §1) → Tasks 2,3,5,6,7 place config/lib/auth/api/providers/routes/ui per layer. ✓
- Data flow + types-only codegen (spec §2, decision 4) → Tasks 4,5. ✓
- Auth/token plumbing + single-flight + TokenStorage swap (spec §3) → Tasks 3,5. ✓
- Code-based routing + history + shell (spec §4, decision 2) → Task 7 (browser history is TanStack Router's default; hash fallback noted in spec). ✓
- Styling/forms/config/codegen (spec §5) → Tasks 1 (Tailwind+HeroUI, safe-area), 2 (config), 4 (codegen). Forms = dependency + convention only (Task 1 install, Task 8 doc). ✓
- Deliverables 1–10 (spec §6) → covered across Tasks 1–8; CLAUDE.md update = Task 8. ✓
- Error handling (spec §7): Query defaults (Task 6), 401 middleware (Task 5). Router error boundary — deferred to first real layout work; placeholder shell has none. **Acceptable for infra scope; noted.**

**Placeholder scan:** No TBD/TODO; every code step has full code. The `VITE_API_URL` prefix branch in Task 4 is a concrete verify-and-set instruction, not a placeholder.

**Type consistency:** `TokenStorage` methods (`getAccess`/`getRefresh`/`setTokens`/`clear`) identical across Tasks 3, 5. `refreshOnce(): Promise<boolean>` consistent (Task 5 def + use). `$api`/`apiClient`/`queryClient` names consistent across Tasks 5, 6, 8. `AppProviders`, `router`, `HomePage` consistent across Tasks 6, 7, 8.
