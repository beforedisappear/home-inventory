# User Profile Page — Design

**Date:** 2026-07-04
**Scope:** Add a protected `/profile` page for the current user: view email, edit name, change email via a 2-step confirmation-code modal. Backend already exposes everything needed — no API changes.

## Goal

The home page currently shows the user's email as plain text with no way to manage the account. This adds a personal-account page reachable from that email/name text, backed by the existing `user` endpoints:

- `GET /api/v1/user/me` — already consumed via `sessionQueries.me()`
- `PATCH /api/v1/user/me` — update `name` (email is excluded from this DTO)
- `POST /api/v1/user/email/request-change` — `{ newEmail }`, sends a 6-digit code to the new address, 15 min TTL (server-side, Redis-backed, keyed by user id)
- `POST /api/v1/user/email/confirm-change` — `{ code }`, applies the pending `newEmail`

## Non-Goals

- No avatar, password, or delete-account UI.
- No new `me`-equivalent query — the profile page reads the same `sessionQueries.me()` cache the home page already warms.
- No resend-with-cooldown component for the email-change code (see Error Handling — closing/reopening the modal is the resend mechanism for v1).
- No parsing of specific backend error codes (400 same-email, 409 taken) into distinct UI messages — generic `toast.danger` per step, matching the existing auth flow's error handling style.

## Routing

- `kernel/routes.ts` — add `PROFILE: '/profile'` to `ROUTES`.
- `app/routes/router.tsx` — add a route under `protectedRoute` (sibling of the existing index route) rendering `UserProfilePage`.
- `pages/home/ui/home-page.tsx` — the email/name `Typography` in the header becomes a `Link` (`@tanstack/react-router`) to `ROUTES.PROFILE`.

## Data Flow

**Reading:** `UserProfilePage` calls `useQuery(sessionQueries.me())` — same cache entry as home page, so navigating there is instant if already warmed.

**Writing — cache sync:** both `updateName` and `confirmEmailChange` mutations, on success, call `queryClient.setQueryData(buildSessionMeKey(), updated)` with the response DTO. This keeps the home page header in sync without a manual refetch, and mirrors the existing pattern in `sessionQueries.authenticate()` (which writes to `tokenStorage` on success).

**Name edit:** single-step form, `defaultValues.name` seeded from the current `me` data. Submit → `PATCH /user/me` → cache update + `toast.success`.

**Email change (modal):** two-step form identical in shape to `useLoginForm` (`step: 'email' | 'code'`):
1. Step `email`: `FormTextField` for `newEmail` → `POST /email/request-change` → on success, advance to step `code`, `toast.success('Код отправлен на новую почту')`.
2. Step `code`: `FormOtpField` (same `CODE_LENGTH = 6` convention) → `POST /email/confirm-change` → on success, cache update, close modal, `toast.success('Email изменён')`.

## Error Handling

- Every mutation failure → `toast.danger` with a generic per-step message (`'Не удалось отправить код'`, `'Неверный код'`, `'Не удалось сохранить имя'`), same style as `useLoginForm`/`LoginFormResend`. No attempt to distinguish 400/409/expired-code server errors in the UI text.
- Closing the modal resets its internal form state; reopening starts at step `email` again — this is the deliberate stand-in for "resend code" in v1.

## Components & Files

**New — `services/user`** (mirrors `services/session` structure):
- `api/update-name.ts` — `updateNameRequest(dto: { name: string })`
- `api/request-email-change.ts` — `requestEmailChangeRequest(dto: { newEmail: string })`
- `api/confirm-email-change.ts` — `confirmEmailChangeRequest(dto: { code: string })`
- `api/user.queries.ts` — `userQueries` factory (`updateName`, `requestEmailChange`, `confirmEmailChange` mutations); the two success handlers call `queryClient.setQueryData(buildSessionMeKey(), ...)`
- `index.ts` — barrel

**New — `features/user-profile`:**
- `model/use-user-profile-form.ts` — name-edit form (`@tanstack/react-form` + `userQueries.updateName`)
- `model/use-user-email-change-form.ts` — 2-step email-change form (`userQueries.requestEmailChange` / `confirmEmailChange`)
- `model/schemas.ts` — `nameSchema`, `newEmailSchema`, `confirmCodeSchema` (zod, mirrors `features/auth/model/schemas.ts`)
- `ui/user-profile-name-form.tsx` — inline name field + save button
- `ui/user-email-change-modal.tsx` — HeroUI `Modal` (trigger button "Изменить email"), hosts the 2-step form using `FormTextField`/`FormOtpField`
- `index.ts` — barrel

**New — `pages/user-profile`:**
- `ui/user-profile-page.tsx` — read-only email, `UserProfileNameForm`, `UserEmailChangeModal`, back-link to home

**Modified:**
- `kernel/routes.ts` — `ROUTES.PROFILE`
- `app/routes/router.tsx` — new child route
- `pages/home/ui/home-page.tsx` — email/name becomes a `Link`

## Verification

- Gate per task: `npx tsc -b --noEmit` from `fe/`.
- Final: `bun run lint` + `bun run build` green.
- Manual (dev server): edit name and see it persist + reflect on home page header; change email end-to-end with a real code from Mailpit; verify closing/reopening the modal resets to step `email`; verify `/profile` redirects unauthenticated users to `/login` (existing guard, no new code needed since it's a child of `protectedRoute`).

## Risks

- HeroUI `Modal` composition (`Modal.Root/Trigger/Backdrop/Container/Dialog/Header/Body/Footer`) — not yet used elsewhere in this codebase; first real usage, may need minor adjustment once wired up.
- Reusing `sessionQueries.me()`'s query key from a different segment (`services/user`) — acceptable coupling since both segments describe the same authenticated identity, but it's the one cross-segment reach in this design.
