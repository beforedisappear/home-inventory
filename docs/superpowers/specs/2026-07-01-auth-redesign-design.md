# Auth UI Redesign — Design

**Date:** 2026-07-01
**Scope:** Restyle login + home pages to the custom HeroUI theme, add a dark-mode toggle, and fix the missing app font. No backend or auth-logic changes.

## Goal

The custom HeroUI theme in `fe/src/app/styles/index.css` (oklch, hue 242, sharp filled fields, rounded accent buttons, light + dark token sets) is not reflected in the UI. The login and home screens still use the default bare layout, the theme's `--font-instrument-sans` is referenced but never loaded, and there is no way to switch between light and dark. This redesign makes both screens present the theme correctly and adds a persistent theme toggle.

## Non-Goals

- No changes to auth flow, form logic, validation, session queries, or the API.
- No new pages or routes.
- No design-system abstraction beyond the two shared pieces this screen needs (`Brand`, `ThemeToggle`).

## Visual Design

**Layout — centered card (both screens share the same card style):** tinted `--background` page, a `--surface` card with `--border`, `--radius` corners (`0.75rem`), soft shadow, `2rem` padding, `max-w-sm` on login.

**Login screen:**
- Full-height centered card.
- Card header: brand mark (accent square + box icon) + "Home Inventory", then `h1` "Вход", then a `--muted` subtitle.
- Below: the existing `LoginForm` (email step → OTP step + resend), CTA button full-width.
- Theme toggle pinned to the top-right corner of the viewport.

**Home screen:**
- Top bar: `Brand` on the left; on the right the user email (`--muted`), the theme toggle, and the "Выйти" button. Bottom border `--border`.
- Main area: centered welcome card of the same style.
- Loading state (`me()` pending): centered spinner, unchanged behavior.

**Fields:** unchanged markup — they already read theme tokens (filled `--field-background`, sharp `--field-radius: 0`, no border, accent focus). The redesign only wraps them in the card.

**Branding:** name "Home Inventory", icon = a box glyph (inline SVG). Accent square background, `--accent-foreground` icon.

## Theme Mechanism

Tokens for both themes already exist in `index.css`. The theme is selected by `document.documentElement.dataset.theme` = `'light' | 'dark'`, which matches the existing CSS selectors (`[data-theme='light']` / `[data-theme='dark']`; the dark block wins over the `:root` light block by source order).

- **Persistence:** `localStorage` key `theme`. If unset, fall back to `prefers-color-scheme`.
- **No flash:** a tiny inline script in `index.html <head>` sets `dataset.theme` from `localStorage`/media query before first paint.
- **Runtime store:** a small module in `shared/theme` holds the current theme, applies it to the DOM, writes `localStorage`, and notifies subscribers. A `useTheme()` hook exposes `{ theme, toggle }` via `useSyncExternalStore`, so any number of toggles stay in sync.
- **Toggle UI:** `ThemeToggle` in `shared/ui` — an icon-only button (sun in dark mode, moon in light mode) calling `toggle`.

## Font Fix

The theme sets `--font-sans: var(--font-instrument-sans)`, but neither the font nor `--font-instrument-sans` is defined.

- Add `@fontsource-variable/instrument-sans` and import it once at the app entry.
- Define `--font-instrument-sans: 'Instrument Sans Variable', ui-sans-serif, system-ui, sans-serif;` in `:root`.
- Apply `font-family: var(--font-sans)`, `background: var(--background)`, `color: var(--foreground)` to `body`.

## Components & Files

**New — `shared/theme`:**
- `theme-store.ts` — `Theme` type, `getTheme`/`setTheme`/`toggleTheme`, `subscribe`, DOM + `localStorage` sync, initial read from `dataset.theme`.
- `use-theme.ts` — `useTheme()` hook over the store.
- `index.ts` — barrel.

**New — `shared/ui`:**
- `theme-toggle.tsx` — `ThemeToggle` icon button (sun/moon), uses `useTheme`.
- `brand.tsx` — `Brand` mark (accent box icon + "Home Inventory").
- both re-exported from `shared/ui/index.ts`.

**Modified:**
- `index.html` — inline no-flash theme script in `<head>`.
- `app/app.tsx` — import the font package.
- `app/styles/index.css` — `--font-instrument-sans`, `body` font/background/color.
- `pages/login/ui/login-page.tsx` — centered card, `Brand`, subtitle, corner `ThemeToggle`.
- `pages/home/ui/home-page.tsx` — top bar (`Brand` + email + `ThemeToggle` + logout) + centered welcome card.
- `features/auth/ui/login-form.tsx` — full-width CTA button.
- `package.json` — `@fontsource-variable/instrument-sans` dependency.

## Verification

- Gate per change: `tsc -b` from `fe/`.
- Final: `bun run build` green.
- Manual: toggle switches themes and persists across reload; no light-mode flash on load; Instrument Sans renders; login + home match the mockup in both themes.

## Risks

- HeroUI Button `className` merge for full-width — trivially adjustable if it rejects.
- `@fontsource-variable/instrument-sans` package name / family string — verified at install time.
