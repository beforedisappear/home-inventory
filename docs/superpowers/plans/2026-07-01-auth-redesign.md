# Auth UI Redesign Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Restyle login + home to the custom HeroUI theme, add a persistent light/dark toggle, and load the missing Instrument Sans font.

**Architecture:** Theme is selected by `document.documentElement.dataset.theme`, matching the existing `[data-theme=...]` CSS token blocks. A small `shared/theme` store applies the theme to the DOM, persists to `localStorage`, and feeds a `useTheme()` hook via `useSyncExternalStore`; an inline `index.html` script sets the theme before first paint to avoid a flash. Two shared UI pieces (`Brand`, `ThemeToggle`) plus card layouts on both pages carry the visual redesign. No auth-logic changes.

**Tech Stack:** React 19, TanStack Router/Query/Form, HeroUI v3, Tailwind v4, Vite 8, `@fontsource-variable/instrument-sans`.

## Global Constraints

- No test framework in this repo. Per-task gate is a typecheck: `cd /Users/beforedisappear/dev/home-inventory/fe && npx tsc -b`. Final gate: `bun run build`.
- Style: single quotes, semicolons. Match surrounding code.
- Work directly on `main`. No branches/worktrees.
- Commit messages: no `Co-Authored-By` / AI attribution.
- Run `bun`/`tsc` from `fe/` with an absolute `cd` prefix (cwd resets between shell calls). Run `git` from repo root `/Users/beforedisappear/dev/home-inventory`.
- Never commit `.DS_Store`, `dist/`, `node_modules/`, or secrets.
- No auth flow, validation, session query, or API changes.

---

### Task 1: Font + base styling

Load Instrument Sans, define the theme's missing font variable, and paint the body background/foreground from theme tokens.

**Files:**
- Modify: `fe/package.json` (add dependency)
- Modify: `fe/src/app/app.tsx:12` (add font import)
- Modify: `fe/src/app/styles/index.css:4-17` (font var + body rules)

**Interfaces:**
- Produces: CSS custom property `--font-instrument-sans`; `body` styled with `var(--font-sans)`, `var(--background)`, `var(--foreground)`.

- [ ] **Step 1: Add the font dependency**

```bash
cd /Users/beforedisappear/dev/home-inventory/fe && bun add @fontsource-variable/instrument-sans
```
Expected: package added to `dependencies`; `bun install` completes.

- [ ] **Step 2: Import the font at app entry**

In `fe/src/app/app.tsx`, add the font CSS import next to the existing style import (line 12 `import './styles/index.css';`). Use the explicit `/index.css` path so it matches the `*.css` ambient module from `vite/client`:

```tsx
import '@fontsource-variable/instrument-sans/index.css';
import './styles/index.css';
```

- [ ] **Step 3: Define `--font-instrument-sans` and style the body**

In `fe/src/app/styles/index.css`, extend the top `:root` block and the `body` rule:

```css
:root {
  --safe-top: env(safe-area-inset-top, 0px);
  --safe-bottom: env(safe-area-inset-bottom, 0px);
  --font-instrument-sans: 'Instrument Sans Variable', ui-sans-serif, system-ui,
    sans-serif;
}

html,
body,
#root {
  height: 100%;
}

body {
  margin: 0;
  font-family: var(--font-sans);
  background: var(--background);
  color: var(--foreground);
}
```

(The theme's `--font-sans: var(--font-instrument-sans)` in the `:root,.light,...` block now resolves; the light block's `:root` selector keeps `--font-sans` defined even under `[data-theme='dark']`, so only colors switch.)

- [ ] **Step 4: Typecheck + build**

Run: `cd /Users/beforedisappear/dev/home-inventory/fe && npx tsc -b && bun run build`
Expected: no errors; `dist/` produced. (Build here confirms the CSS import resolves.)

- [ ] **Step 5: Commit**

```bash
cd /Users/beforedisappear/dev/home-inventory && git add fe/package.json fe/bun.lock fe/src/app/app.tsx fe/src/app/styles/index.css && git commit -m "feat(fe): load Instrument Sans and paint body from theme tokens"
```
(If the lockfile is named differently, add the actual lockfile that changed; do not add `node_modules` or `dist`.)

---

### Task 2: Theme mechanism (store + hook + no-flash script)

Create the `shared/theme` store and hook, and set the initial theme before first paint.

**Files:**
- Create: `fe/src/shared/theme/theme-store.ts`
- Create: `fe/src/shared/theme/use-theme.ts`
- Create: `fe/src/shared/theme/index.ts`
- Modify: `fe/index.html` (inline script in `<head>`)

**Interfaces:**
- Produces:
  - `type Theme = 'light' | 'dark'`
  - `getTheme(): Theme`, `setTheme(theme: Theme): void`, `toggleTheme(): void`, `subscribe(listener: () => void): () => void`
  - `useTheme(): { theme: Theme; toggle: () => void }`

- [ ] **Step 1: Write the theme store**

Create `fe/src/shared/theme/theme-store.ts`:

```ts
export type Theme = 'light' | 'dark';

const STORAGE_KEY = 'theme';

function isTheme(value: unknown): value is Theme {
  return value === 'light' || value === 'dark';
}

// системное предпочтение, если пользователь ещё не выбирал тему
function systemTheme(): Theme {
  return window.matchMedia('(prefers-color-scheme: dark)').matches
    ? 'dark'
    : 'light';
}

// стартовая тема: сперва data-theme от inline-скрипта, затем localStorage, затем система
function readInitial(): Theme {
  const attr = document.documentElement.dataset.theme;
  if (isTheme(attr)) return attr;

  const stored = localStorage.getItem(STORAGE_KEY);
  if (isTheme(stored)) return stored;

  return systemTheme();
}

let current: Theme = readInitial();
let listeners: (() => void)[] = [];

function apply(theme: Theme): void {
  document.documentElement.dataset.theme = theme;
}

export function getTheme(): Theme {
  return current;
}

export function setTheme(theme: Theme): void {
  current = theme;
  apply(theme);
  localStorage.setItem(STORAGE_KEY, theme);
  listeners.forEach(listener => listener());
}

export function toggleTheme(): void {
  setTheme(current === 'dark' ? 'light' : 'dark');
}

export function subscribe(listener: () => void): () => void {
  listeners.push(listener);
  return () => {
    listeners = listeners.filter(item => item !== listener);
  };
}
```

- [ ] **Step 2: Write the hook**

Create `fe/src/shared/theme/use-theme.ts`:

```ts
import { useSyncExternalStore } from 'react';

import { getTheme, subscribe, toggleTheme } from './theme-store';

// подписка на тему; toggle переключает light/dark и сохраняет выбор
export function useTheme() {
  const theme = useSyncExternalStore(subscribe, getTheme, getTheme);
  return { theme, toggle: toggleTheme };
}
```

- [ ] **Step 3: Write the barrel**

Create `fe/src/shared/theme/index.ts`:

```ts
export { getTheme, setTheme, toggleTheme, subscribe } from './theme-store';
export type { Theme } from './theme-store';
export { useTheme } from './use-theme';
```

- [ ] **Step 4: Add the no-flash inline script**

In `fe/index.html`, inside `<head>` (after the viewport meta, before `</head>`), add:

```html
<script>
  (function () {
    try {
      var stored = localStorage.getItem('theme');
      var theme =
        stored === 'light' || stored === 'dark'
          ? stored
          : window.matchMedia('(prefers-color-scheme: dark)').matches
            ? 'dark'
            : 'light';
      document.documentElement.dataset.theme = theme;
    } catch (e) {
      /* localStorage unavailable — fall back to default light tokens */
    }
  })();
</script>
```

- [ ] **Step 5: Typecheck**

Run: `cd /Users/beforedisappear/dev/home-inventory/fe && npx tsc -b`
Expected: no errors.

- [ ] **Step 6: Commit**

```bash
cd /Users/beforedisappear/dev/home-inventory && git add fe/src/shared/theme fe/index.html && git commit -m "feat(fe): theme store, useTheme hook, no-flash init"
```

---

### Task 3: Shared UI — Brand + ThemeToggle

Add the branded logo mark and the icon theme toggle, exported from the `shared/ui` barrel.

**Files:**
- Create: `fe/src/shared/ui/brand.tsx`
- Create: `fe/src/shared/ui/theme-toggle.tsx`
- Modify: `fe/src/shared/ui/index.ts`

**Interfaces:**
- Consumes: `useTheme` from `@/shared/theme` (Task 2).
- Produces: `Brand` and `ThemeToggle` React components, re-exported from `@/shared/ui`.

- [ ] **Step 1: Write the Brand component**

Create `fe/src/shared/ui/brand.tsx`:

```tsx
// логотип приложения: акцентный квадрат с иконкой-коробкой + название
export function Brand() {
  return (
    <div className='flex items-center gap-2'>
      <span className='flex size-8 items-center justify-center rounded-lg bg-[var(--accent)] text-[var(--accent-foreground)]'>
        <svg
          width={18}
          height={18}
          viewBox='0 0 24 24'
          fill='none'
          stroke='currentColor'
          strokeWidth={2}
          strokeLinecap='round'
          strokeLinejoin='round'
        >
          <path d='M21 8l-9-5-9 5v8l9 5 9-5V8Z' />
          <path d='M3.3 7 12 12l8.7-5M12 22V12' />
        </svg>
      </span>
      <span className='text-base font-semibold text-[var(--foreground)]'>
        Home Inventory
      </span>
    </div>
  );
}
```

- [ ] **Step 2: Write the ThemeToggle component**

Create `fe/src/shared/ui/theme-toggle.tsx`:

```tsx
import { useTheme } from '@/shared/theme';

const iconProps = {
  width: 18,
  height: 18,
  viewBox: '0 0 24 24',
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 2,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
} as const;

function SunIcon() {
  return (
    <svg {...iconProps}>
      <circle cx='12' cy='12' r='4' />
      <path d='M12 2v2M12 20v2M4.9 4.9l1.4 1.4M17.7 17.7l1.4 1.4M2 12h2M20 12h2M4.9 19.1l1.4-1.4M17.7 6.3l1.4-1.4' />
    </svg>
  );
}

function MoonIcon() {
  return (
    <svg {...iconProps}>
      <path d='M21 12.8A9 9 0 1 1 11.2 3 7 7 0 0 0 21 12.8Z' />
    </svg>
  );
}

// переключатель темы: в тёмной теме показывает солнце, в светлой — луну
export function ThemeToggle() {
  const { theme, toggle } = useTheme();
  const isDark = theme === 'dark';

  return (
    <button
      type='button'
      onClick={toggle}
      aria-label={isDark ? 'Светлая тема' : 'Тёмная тема'}
      className='flex size-9 items-center justify-center rounded-lg border border-[var(--border)] bg-[var(--surface)] text-[var(--foreground)] transition-colors hover:bg-[var(--surface-secondary)]'
    >
      {isDark ? <SunIcon /> : <MoonIcon />}
    </button>
  );
}
```

- [ ] **Step 3: Export from the barrel**

In `fe/src/shared/ui/index.ts`, add these exports (keep the existing HeroUI re-exports and form-field exports):

```ts
export { Brand } from './brand';
export { ThemeToggle } from './theme-toggle';
```

- [ ] **Step 4: Typecheck**

Run: `cd /Users/beforedisappear/dev/home-inventory/fe && npx tsc -b`
Expected: no errors.

- [ ] **Step 5: Commit**

```bash
cd /Users/beforedisappear/dev/home-inventory && git add fe/src/shared/ui && git commit -m "feat(fe): Brand mark and ThemeToggle in shared/ui"
```

---

### Task 4: Login page redesign

Wrap the login form in a centered themed card with brand + subtitle, pin the theme toggle to the corner, and make the CTA full-width.

**Files:**
- Modify: `fe/src/pages/login/ui/login-page.tsx` (full rewrite)
- Modify: `fe/src/features/auth/ui/login-form.tsx:44` (CTA `className='w-full'`)

**Interfaces:**
- Consumes: `Brand`, `ThemeToggle` from `@/shared/ui` (Task 3); `LoginForm` from `@/features/auth` (unchanged export).

- [ ] **Step 1: Rewrite the login page**

Replace the contents of `fe/src/pages/login/ui/login-page.tsx`:

```tsx
import { LoginForm } from '@/features/auth';
import { Brand, ThemeToggle } from '@/shared/ui';

export function LoginPage() {
  return (
    <div className='relative flex min-h-svh items-center justify-center p-4'>
      <div className='absolute right-4 top-4'>
        <ThemeToggle />
      </div>

      <div className='w-full max-w-sm rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8 shadow-xl'>
        <Brand />

        <h1 className='mt-6 text-2xl font-bold text-[var(--foreground)]'>
          Вход
        </h1>
        <p className='mb-6 mt-1 text-sm text-[var(--muted)]'>
          Войдите по коду из письма
        </p>

        <LoginForm />
      </div>
    </div>
  );
}
```

- [ ] **Step 2: Make the CTA full-width**

In `fe/src/features/auth/ui/login-form.tsx`, add `className='w-full'` to the submit `Button` (the email-step branch):

```tsx
<Button
  type='submit'
  className='w-full'
  isDisabled={!canSubmit || isSubmitting}
>
  {isSubmitting ? <Spinner /> : 'Получить код'}
</Button>
```

(If HeroUI `Button` rejects `className` under tsc, drop the prop and wrap the button in a `<div className='w-full [&>button]:w-full'>` instead. The rest of `login-form.tsx` is unchanged.)

- [ ] **Step 3: Typecheck**

Run: `cd /Users/beforedisappear/dev/home-inventory/fe && npx tsc -b`
Expected: no errors.

- [ ] **Step 4: Commit**

```bash
cd /Users/beforedisappear/dev/home-inventory && git add fe/src/pages/login/ui/login-page.tsx fe/src/features/auth/ui/login-form.tsx && git commit -m "feat(fe): redesign login as centered themed card"
```

---

### Task 5: Home page redesign + final build

Give home a top bar (brand + email + toggle + logout) and a centered welcome card, then run the final build.

**Files:**
- Modify: `fe/src/pages/home/ui/home-page.tsx` (full rewrite)

**Interfaces:**
- Consumes: `Brand`, `ThemeToggle`, `Button`, `Spinner` from `@/shared/ui`; `sessionQueries` from `@/services/session` (unchanged).

- [ ] **Step 1: Rewrite the home page**

Replace the contents of `fe/src/pages/home/ui/home-page.tsx`:

```tsx
import { useMutation, useQuery } from '@tanstack/react-query';
import { useNavigate } from '@tanstack/react-router';

import { sessionQueries } from '@/services/session';
import { Brand, Button, Spinner, ThemeToggle } from '@/shared/ui';

export function HomePage() {
  const navigate = useNavigate();
  const { data: user, isPending } = useQuery(sessionQueries.me());
  const logout = useMutation(sessionQueries.logout());

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSettled: () => {
        void navigate({ to: '/login' });
      },
    });
  };

  if (isPending) {
    return (
      <div className='flex min-h-svh items-center justify-center'>
        <Spinner />
      </div>
    );
  }

  return (
    <div className='flex min-h-svh flex-col'>
      <header className='flex items-center justify-between border-b border-[var(--border)] px-6 py-4'>
        <Brand />
        <div className='flex items-center gap-3'>
          <span className='hidden text-sm text-[var(--muted)] sm:inline'>
            {user?.email}
          </span>
          <ThemeToggle />
          <Button
            type='button'
            isDisabled={logout.isPending}
            onPress={handleLogout}
          >
            Выйти
          </Button>
        </div>
      </header>

      <main className='flex flex-1 items-center justify-center p-4'>
        <div className='w-full max-w-md rounded-2xl border border-[var(--border)] bg-[var(--surface)] p-8'>
          <h1 className='text-2xl font-bold text-[var(--foreground)]'>
            Home Inventory
          </h1>
          <p className='mt-1 text-sm text-[var(--muted)]'>
            Вы вошли как {user?.email}
          </p>
        </div>
      </main>
    </div>
  );
}
```

- [ ] **Step 2: Final typecheck + build**

Run: `cd /Users/beforedisappear/dev/home-inventory/fe && npx tsc -b && bun run build`
Expected: no errors; `dist/` produced.

- [ ] **Step 3: Manual visual check (dev server)**

Run: `cd /Users/beforedisappear/dev/home-inventory/fe && bun run dev`
Confirm: login is a centered card; toggle switches light↔dark and persists across reload; no light flash on load; Instrument Sans renders; home shows the top bar + welcome card in both themes. Stop the dev server when done.

- [ ] **Step 4: Commit**

```bash
cd /Users/beforedisappear/dev/home-inventory && git add fe/src/pages/home/ui/home-page.tsx && git commit -m "feat(fe): redesign home with top bar and welcome card"
```

---

## Self-Review

- **Spec coverage:** centered card (Tasks 4, 5) ✓; theme toggle + persistence + no-flash (Task 2, 3) ✓; font fix (Task 1) ✓; body background from tokens (Task 1) ✓; brand mark (Task 3) ✓; home top bar (Task 5) ✓. No auth-logic changes ✓.
- **Placeholder scan:** none — every step has concrete code/commands.
- **Type consistency:** `Theme`, `getTheme`, `toggleTheme`, `subscribe`, `useTheme` names match across `theme-store.ts`, `use-theme.ts`, `index.ts`, and `theme-toggle.tsx`. `Brand`/`ThemeToggle` export names match their barrel re-exports and page imports.
- **Known adjustables:** HeroUI `Button` `className` (Task 4 Step 2 has a fallback); lockfile name in Task 1 Step 5.
