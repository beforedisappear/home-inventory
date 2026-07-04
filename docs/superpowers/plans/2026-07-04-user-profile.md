# User Profile Page Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Add a protected `/profile` page where the current user can view their email, edit their name, and change their email through a 2-step confirmation-code modal.

**Architecture:** `services/user` adds a `userQueries` factory (mirrors the existing `sessionQueries` factory) wrapping the three already-generated `user` endpoints; its `updateName`/`confirmEmailChange` mutations write straight into the existing `sessionQueries.me()` cache entry via `queryClient.setQueryData`, so the profile page and home-page header always agree without a manual refetch. `features/user-profile` holds two independent UI units — a plain name-edit form and a HeroUI `Modal`-based 2-step email-change flow (shaped exactly like the existing `useLoginForm`) — composed together on `pages/user-profile`. Routing adds one sibling route under the existing `protectedRoute`, so the unauthenticated-redirect guard applies for free.

**Tech Stack:** React 19, TanStack Router/Query/Form, HeroUI v3 (`Modal`, `useOverlayState`), Tailwind v4, zod, Bun.

## Global Constraints

- No test framework in this repo. Per-task gate is a typecheck: `cd /Users/beforedisappear/dev/home-inventory/fe && npx tsc -b`. Final gate: `bun run lint && bun run build`.
- Style: single quotes, semicolons, no unnecessary comments (only WHY-comments, matching surrounding files).
- FSD layer order `app → pages → features → services → kernel → shared` — no upward imports.
- Work directly on `main`. No branches/worktrees.
- Run `bun`/`tsc` from `fe/` with an absolute `cd` prefix (cwd resets between shell calls). Run `git` from repo root `/Users/beforedisappear/dev/home-inventory`.
- Commit messages: no `Co-Authored-By` / AI attribution.
- **Never run `git commit` without the user's explicit go-ahead for that specific commit** — this overrides the per-task "Commit" steps below. Confirm with the user how they want commits handled (per task, or one batched commit at the end) before executing any Commit step.
- No backend/API changes — all three endpoints (`GET/PATCH /user/me`, `POST /user/email/request-change`, `POST /user/email/confirm-change`) and their OpenAPI types already exist.
- No avatar, password, or delete-account UI. No resend-with-cooldown component for the email code (closing/reopening the modal is the v1 resend mechanism). No parsing of specific backend error codes into distinct UI messages — generic `toast.danger` per step.

---

### Task 1: Routing — `/profile` scaffold + home-page link

Add the route, a minimal (read-only) profile page, and wire the home-page header text into a link to it.

**Files:**
- Modify: `fe/src/kernel/routes.ts` (full rewrite)
- Modify: `fe/src/app/routes/router.tsx` (full rewrite)
- Create: `fe/src/pages/user-profile/ui/user-profile-page.tsx`
- Create: `fe/src/pages/user-profile/index.ts`
- Modify: `fe/src/pages/home/ui/home-page.tsx` (full rewrite)

**Interfaces:**
- Consumes: `sessionQueries.me()` from `@/services/session` (existing); `ROUTES` from `@/kernel/routes`.
- Produces: `ROUTES.PROFILE = '/profile'`; `UserProfilePage` component exported from `@/pages/user-profile`; a route at `path: ROUTES.PROFILE` as a child of `protectedRoute`.

- [ ] **Step 1: Add the route constant**

Replace `fe/src/kernel/routes.ts`:

```ts
export const ROUTES = {
  HOME: '/',
  LOGIN: '/login',
  PROFILE: '/profile',
} as const;
```

- [ ] **Step 2: Write the minimal profile page**

Create `fe/src/pages/user-profile/ui/user-profile-page.tsx`:

```tsx
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';

import { sessionQueries } from '@/services/session';

import { ROUTES } from '@/kernel/routes';

import { Spinner, Typography } from '@/shared/ui';

export function UserProfilePage() {
  const { data: user, isPending } = useQuery(sessionQueries.me());

  if (isPending) {
    return (
      <div className='flex min-h-svh items-center justify-center'>
        <Spinner />
      </div>
    );
  }

  return (
    <div className='flex min-h-svh flex-col items-center p-4'>
      <div className='w-full max-w-md rounded-2xl border border-border bg-surface p-8 shadow-xl'>
        <Typography.Heading level={3}>Профиль</Typography.Heading>

        <Typography type='body-sm' color='muted' className='mt-4'>
          Email
        </Typography>
        <Typography className='mt-1'>{user?.email}</Typography>

        <Link to={ROUTES.HOME} className='mt-6 inline-block'>
          <Typography type='body-sm' className='text-accent'>
            ← На главную
          </Typography>
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 3: Write the barrel**

Create `fe/src/pages/user-profile/index.ts`:

```ts
export { UserProfilePage } from './ui/user-profile-page';
```

- [ ] **Step 4: Wire the route**

Replace `fe/src/app/routes/router.tsx`:

```tsx
import {
  createRootRoute,
  createRoute,
  createRouter,
  redirect,
} from '@tanstack/react-router';

import { HomePage } from '@/pages/home';
import { LoginPage } from '@/pages/login';
import { UserProfilePage } from '@/pages/user-profile';

import { ROUTES } from '@/kernel/routes';

import { tokenStorage } from '@/shared/api/token-storage';

import { RootLayout } from '../layouts/root-layout';

// Регистрируем типы (чтобы роутер работал с TS без костылей)
declare module '@tanstack/react-router' {
  interface Register {
    router: typeof router;
  }
}

const rootRoute = createRootRoute({ component: RootLayout });

const protectedRoute = createRoute({
  id: 'protected',
  getParentRoute: () => rootRoute,
  beforeLoad: () => {
    if (!tokenStorage.getAccess()) {
      throw redirect({ to: ROUTES.LOGIN });
    }
  },
});

const indexRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: ROUTES.HOME,
  component: HomePage,
});

const profileRoute = createRoute({
  getParentRoute: () => protectedRoute,
  path: ROUTES.PROFILE,
  component: UserProfilePage,
});

const protectedRoutes = protectedRoute.addChildren([indexRoute, profileRoute]);

const publicRoutes = [
  createRoute({
    getParentRoute: () => rootRoute,
    path: ROUTES.LOGIN,
    component: LoginPage,
    beforeLoad: () => {
      if (tokenStorage.getAccess()) {
        throw redirect({ to: ROUTES.HOME });
      }
    },
  }),
];

const routeTree = rootRoute.addChildren([protectedRoutes, ...publicRoutes]);

export const router = createRouter({ routeTree });
```

- [ ] **Step 5: Turn the home-page header text into a link**

Replace `fe/src/pages/home/ui/home-page.tsx`:

```tsx
import { useMutation, useQuery } from '@tanstack/react-query';
import { Link, useNavigate } from '@tanstack/react-router';

import { sessionQueries } from '@/services/session';

import { PROJECT_NAME } from '@/kernel/project';
import { ROUTES } from '@/kernel/routes';

import { Brand, Button, Spinner, ThemeToggle, Typography } from '@/shared/ui';

export function HomePage() {
  const navigate = useNavigate();

  const { data: user, isPending } = useQuery(sessionQueries.me());
  const logout = useMutation(sessionQueries.logout());

  const handleLogout = () => {
    logout.mutate(undefined, {
      onSettled: () => {
        void navigate({ to: ROUTES.LOGIN });
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
      <header className='flex items-center justify-between border-b border-border px-6 py-4'>
        <Brand title={PROJECT_NAME} />

        <div className='flex items-center gap-3'>
          <Link to={ROUTES.PROFILE} className='hidden sm:inline'>
            <Typography type='body-sm' color='muted'>
              {user?.email}
            </Typography>
          </Link>
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
    </div>
  );
}
```

- [ ] **Step 6: Typecheck**

Run: `cd /Users/beforedisappear/dev/home-inventory/fe && npx tsc -b`
Expected: no errors.

- [ ] **Step 7: Manual check (dev server)**

Run: `cd /Users/beforedisappear/dev/home-inventory/fe && bun run dev`
Confirm: logged in, click the email in the home header → lands on `/profile` showing the email in a card; "← На главную" returns home. Navigate to `/profile` directly while logged out → redirected to `/login` (existing guard). Stop the dev server when done.

- [ ] **Step 8: Commit**

```bash
cd /Users/beforedisappear/dev/home-inventory && git add fe/src/kernel/routes.ts fe/src/app/routes/router.tsx fe/src/pages/user-profile fe/src/pages/home/ui/home-page.tsx && git commit -m "feat(fe): add /profile route with read-only page"
```

---

### Task 2: `services/user` — API layer + query factory

Add the three request functions and the `userQueries` factory, mirroring `services/session`.

**Files:**
- Create: `fe/src/services/user/api/update-name.ts`
- Create: `fe/src/services/user/api/request-email-change.ts`
- Create: `fe/src/services/user/api/confirm-email-change.ts`
- Create: `fe/src/services/user/api/user.queries.ts`
- Create: `fe/src/services/user/index.ts`

**Interfaces:**
- Consumes: `buildSessionMeKey` from `@/kernel/session/keys` (existing); `queryClient` from `@/shared/api/query-client` (existing); `apiClient` from `@/shared/api/api-client` (existing); `components['schemas']['UpdateUserDto' | 'RequestEmailChangeDto' | 'ConfirmEmailChangeDto']` from `@/kernel/api/schema` (existing, already generated).
- Produces: `userQueries.updateName()`, `userQueries.requestEmailChange()`, `userQueries.confirmEmailChange()` — all `mutationOptions()` results, consumed by `useMutation()` in Tasks 3–4.

- [ ] **Step 1: Write `updateNameRequest`**

Create `fe/src/services/user/api/update-name.ts`:

```ts
import type { components } from '@/kernel/api/schema';
import { apiClient } from '@/shared/api/api-client';

type UpdateUserDto = components['schemas']['UpdateUserDto'];

export async function updateNameRequest(dto: UpdateUserDto) {
  const { data, error } = await apiClient.PATCH('/api/v1/user/me', {
    body: dto,
  });

  if (error) throw error;

  return data!;
}
```

- [ ] **Step 2: Write `requestEmailChangeRequest`**

Create `fe/src/services/user/api/request-email-change.ts`:

```ts
import type { components } from '@/kernel/api/schema';
import { apiClient } from '@/shared/api/api-client';

type RequestEmailChangeDto = components['schemas']['RequestEmailChangeDto'];

export async function requestEmailChangeRequest(
  dto: RequestEmailChangeDto,
) {
  const { data, error } = await apiClient.POST(
    '/api/v1/user/email/request-change',
    { body: dto },
  );

  if (error) throw error;

  return data!;
}
```

- [ ] **Step 3: Write `confirmEmailChangeRequest`**

Create `fe/src/services/user/api/confirm-email-change.ts`:

```ts
import type { components } from '@/kernel/api/schema';
import { apiClient } from '@/shared/api/api-client';

type ConfirmEmailChangeDto = components['schemas']['ConfirmEmailChangeDto'];

export async function confirmEmailChangeRequest(
  dto: ConfirmEmailChangeDto,
) {
  const { data, error } = await apiClient.POST(
    '/api/v1/user/email/confirm-change',
    { body: dto },
  );

  if (error) throw error;

  return data!;
}
```

- [ ] **Step 4: Write the `userQueries` factory**

Create `fe/src/services/user/api/user.queries.ts`:

```ts
import { mutationOptions } from '@tanstack/react-query';

import { buildSessionMeKey } from '@/kernel/session/keys';

import { queryClient } from '@/shared/api/query-client';

import { confirmEmailChangeRequest } from './confirm-email-change';
import { requestEmailChangeRequest } from './request-email-change';
import { updateNameRequest } from './update-name';

export const userQueries = {
  updateName: () =>
    mutationOptions({
      mutationFn: updateNameRequest,
      onSuccess: data => {
        queryClient.setQueryData(buildSessionMeKey(), data);
      },
    }),

  requestEmailChange: () =>
    mutationOptions({
      mutationFn: requestEmailChangeRequest,
    }),

  confirmEmailChange: () =>
    mutationOptions({
      mutationFn: confirmEmailChangeRequest,
      onSuccess: data => {
        queryClient.setQueryData(buildSessionMeKey(), data);
      },
    }),
};
```

- [ ] **Step 5: Write the barrel**

Create `fe/src/services/user/index.ts`:

```ts
export { userQueries } from './api/user.queries';
```

- [ ] **Step 6: Typecheck**

Run: `cd /Users/beforedisappear/dev/home-inventory/fe && npx tsc -b`
Expected: no errors.

- [ ] **Step 7: Commit**

```bash
cd /Users/beforedisappear/dev/home-inventory && git add fe/src/services/user && git commit -m "feat(fe): add services/user query factory"
```

---

### Task 3: Name-edit form

Add the name-edit form (one step, seeded from the current `me` value) and wire it into the profile page.

**Files:**
- Create: `fe/src/features/user-profile/model/schemas.ts`
- Create: `fe/src/features/user-profile/model/use-user-profile-form.ts`
- Create: `fe/src/features/user-profile/ui/user-profile-name-form.tsx`
- Create: `fe/src/features/user-profile/index.ts`
- Modify: `fe/src/pages/user-profile/ui/user-profile-page.tsx` (full rewrite)

**Interfaces:**
- Consumes: `userQueries.updateName()` from `@/services/user` (Task 2); `toast`, `FormTextField`, `Button`, `Spinner` from `@/shared/ui` (existing).
- Produces: `nameSchema` (zod); `useUserProfileForm({ name: string }): { form }`; `UserProfileNameForm` component (props: `{ name: string }`), exported from `@/features/user-profile`.

- [ ] **Step 1: Write the name schema**

Create `fe/src/features/user-profile/model/schemas.ts`:

```ts
import { z } from 'zod';

export const nameSchema = z.object({
  name: z.string().min(1, 'Введите имя').max(64, 'Слишком длинное имя'),
});
```

- [ ] **Step 2: Write the form hook**

Create `fe/src/features/user-profile/model/use-user-profile-form.ts`:

```ts
import { useForm } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';

import { userQueries } from '@/services/user';

import { toast } from '@/shared/ui';

import { nameSchema } from './schemas';

interface UseUserProfileFormProps {
  name: string;
}

// форма редактирования имени: одно поле, значение подставляется из текущего me
export function useUserProfileForm(props: UseUserProfileFormProps) {
  const { mutateAsync: updateName } = useMutation(userQueries.updateName());

  const form = useForm({
    defaultValues: { name: props.name },
    validators: { onSubmit: nameSchema },
    onSubmit: async ({ value }) => {
      try {
        await updateName({ name: value.name });
        toast.success('Имя сохранено');
      } catch {
        toast.danger('Не удалось сохранить имя');
      }
    },
  });

  return { form };
}
```

- [ ] **Step 3: Write the form UI**

Create `fe/src/features/user-profile/ui/user-profile-name-form.tsx`:

```tsx
import { Button, FormTextField, Spinner } from '@/shared/ui';

import { useUserProfileForm } from '../model/use-user-profile-form';

interface UserProfileNameFormProps {
  name: string;
}

export function UserProfileNameForm(props: UserProfileNameFormProps) {
  const { form } = useUserProfileForm({ name: props.name });

  return (
    <form
      className='flex flex-col gap-3'
      onSubmit={e => {
        e.preventDefault();
        e.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <form.Field name='name'>
        {field => <FormTextField field={field} label='Имя' />}
      </form.Field>

      <form.Subscribe
        selector={state => ({
          canSubmit: state.canSubmit,
          isSubmitting: state.isSubmitting,
        })}
      >
        {({ canSubmit, isSubmitting }) => (
          <Button
            type='submit'
            className='self-start'
            isDisabled={!canSubmit || isSubmitting}
          >
            {isSubmitting ? <Spinner /> : 'Сохранить'}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
```

- [ ] **Step 4: Write the barrel**

Create `fe/src/features/user-profile/index.ts`:

```ts
export { UserProfileNameForm } from './ui/user-profile-name-form';
```

- [ ] **Step 5: Wire the form into the profile page**

Replace `fe/src/pages/user-profile/ui/user-profile-page.tsx`:

```tsx
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';

import { UserProfileNameForm } from '@/features/user-profile';

import { sessionQueries } from '@/services/session';

import { ROUTES } from '@/kernel/routes';

import { Spinner, Typography } from '@/shared/ui';

export function UserProfilePage() {
  const { data: user, isPending } = useQuery(sessionQueries.me());

  if (isPending) {
    return (
      <div className='flex min-h-svh items-center justify-center'>
        <Spinner />
      </div>
    );
  }

  return (
    <div className='flex min-h-svh flex-col items-center p-4'>
      <div className='w-full max-w-md rounded-2xl border border-border bg-surface p-8 shadow-xl'>
        <Typography.Heading level={3}>Профиль</Typography.Heading>

        <Typography type='body-sm' color='muted' className='mt-4'>
          Email
        </Typography>
        <Typography className='mt-1'>{user?.email}</Typography>

        <div className='mt-6'>
          <Typography type='body-sm' color='muted'>
            Имя
          </Typography>
          <div className='mt-1'>
            <UserProfileNameForm name={user?.name ?? ''} />
          </div>
        </div>

        <Link to={ROUTES.HOME} className='mt-6 inline-block'>
          <Typography type='body-sm' className='text-accent'>
            ← На главную
          </Typography>
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 6: Typecheck**

Run: `cd /Users/beforedisappear/dev/home-inventory/fe && npx tsc -b`
Expected: no errors.

- [ ] **Step 7: Manual check (dev server)**

Run: `cd /Users/beforedisappear/dev/home-inventory/fe && bun run dev`
Confirm: `/profile` shows an editable name field; changing it and saving shows a success toast, persists on reload, and the change is NOT required to reflect elsewhere (home header shows email, not name). Stop the dev server when done.

- [ ] **Step 8: Commit**

```bash
cd /Users/beforedisappear/dev/home-inventory && git add fe/src/features/user-profile fe/src/pages/user-profile/ui/user-profile-page.tsx && git commit -m "feat(fe): add name-edit form to user profile page"
```

---

### Task 4: Email-change modal

Add the 2-step email-change modal (HeroUI `Modal` + `useOverlayState`, shaped like `useLoginForm`) and wire it into the profile page.

**Files:**
- Modify: `fe/src/shared/ui/index.ts`
- Modify: `fe/src/features/user-profile/model/schemas.ts`
- Create: `fe/src/features/user-profile/model/use-user-email-change-form.ts`
- Create: `fe/src/features/user-profile/ui/user-email-change-modal.tsx`
- Modify: `fe/src/features/user-profile/index.ts`
- Modify: `fe/src/pages/user-profile/ui/user-profile-page.tsx` (full rewrite)

**Interfaces:**
- Consumes: `userQueries.requestEmailChange()`, `userQueries.confirmEmailChange()` from `@/services/user` (Task 2); `Modal`, `useOverlayState` from `@/shared/ui` (this task); `FormOtpField` from `@/shared/ui` (existing).
- Produces: `CODE_LENGTH`, `newEmailSchema`, `confirmCodeSchema` (added to the existing `schemas.ts`); `useUserEmailChangeForm({ onSuccess: () => void }): { form, step, reset }`; `UserEmailChangeModal` component, exported from `@/features/user-profile`.

- [ ] **Step 1: Re-export `Modal` + `useOverlayState` from `shared/ui`**

In `fe/src/shared/ui/index.ts`, replace the top HeroUI re-export block:

```ts
// единая точка ui-kit: фичи берут компоненты отсюда, не из @heroui/react напрямую
export {
  Button,
  ErrorMessage,
  Input,
  Label,
  Modal,
  Spinner,
  TextField,
  Toast,
  toast,
  Typography,
  useOverlayState,
} from '@heroui/react';

export { Brand } from './brand';
export { FormOtpField } from './form-otp-field';
export { FormTextField } from './form-text-field';
export { ThemeToggle } from './theme-toggle';
```

- [ ] **Step 2: Extend the schemas file**

Replace `fe/src/features/user-profile/model/schemas.ts`:

```ts
import { z } from 'zod';

export const nameSchema = z.object({
  name: z.string().min(1, 'Введите имя').max(64, 'Слишком длинное имя'),
});

// длина OTP-кода (бэк валидирует @Length(6, 6))
export const CODE_LENGTH = 6;

const newEmail = z.email('Введите корректный email');

// шаг email: код ещё не введён, проверяем только адрес
export const newEmailSchema = z.object({
  newEmail,
  code: z.string(),
});

// шаг code: тот же адрес + обязательный код
export const confirmCodeSchema = z.object({
  newEmail,
  code: z.string().length(CODE_LENGTH, 'Введите код из 6 цифр'),
});
```

- [ ] **Step 3: Write the 2-step form hook**

Create `fe/src/features/user-profile/model/use-user-email-change-form.ts`:

```ts
import { useState } from 'react';

import { useForm } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';

import { userQueries } from '@/services/user';

import { toast } from '@/shared/ui';

import { confirmCodeSchema, newEmailSchema } from './schemas';

type Step = 'email' | 'code';

interface UseUserEmailChangeFormProps {
  onSuccess: () => void;
}

// вся логика двухшаговой смены email: стейт шага, мутации, валидация, сабмит
export function useUserEmailChangeForm(props: UseUserEmailChangeFormProps) {
  const [step, setStep] = useState<Step>('email');

  const { mutateAsync: requestEmailChange } = useMutation(
    userQueries.requestEmailChange(),
  );
  const { mutateAsync: confirmEmailChange } = useMutation(
    userQueries.confirmEmailChange(),
  );

  const form = useForm({
    defaultValues: { newEmail: '', code: '' },
    validators: {
      onSubmit: step === 'email' ? newEmailSchema : confirmCodeSchema,
    },
    onSubmit: async ({ value }) => {
      if (step === 'email') {
        try {
          await requestEmailChange({ newEmail: value.newEmail });
          toast.success('Код отправлен на новую почту');
          setStep('code');
        } catch {
          toast.danger('Не удалось отправить код');
        }

        return;
      }

      try {
        await confirmEmailChange({ code: value.code });
        toast.success('Email изменён');
        props.onSuccess();
      } catch {
        toast.danger('Неверный код');
      }
    },
  });

  function reset() {
    setStep('email');
    form.reset();
  }

  return { form, step, reset };
}
```

- [ ] **Step 4: Write the modal UI**

Create `fe/src/features/user-profile/ui/user-email-change-modal.tsx`:

```tsx
import {
  Button,
  FormOtpField,
  FormTextField,
  Modal,
  Spinner,
  useOverlayState,
} from '@/shared/ui';

import { CODE_LENGTH } from '../model/schemas';
import { useUserEmailChangeForm } from '../model/use-user-email-change-form';

export function UserEmailChangeModal() {
  const state = useOverlayState();
  const { form, step, reset } = useUserEmailChangeForm({
    onSuccess: () => state.close(),
  });

  return (
    <Modal.Root
      state={state}
      onOpenChange={isOpen => {
        if (!isOpen) reset();
      }}
    >
      <Modal.Trigger>
        <Button type='button'>Изменить email</Button>
      </Modal.Trigger>

      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog>
            <Modal.Header>
              <Modal.Heading>Смена email</Modal.Heading>
              <Modal.CloseTrigger />
            </Modal.Header>

            <form
              onSubmit={e => {
                e.preventDefault();
                e.stopPropagation();
                void form.handleSubmit();
              }}
            >
              <Modal.Body className='flex flex-col gap-4'>
                {step === 'email' ? (
                  <form.Field name='newEmail'>
                    {field => (
                      <FormTextField
                        field={field}
                        label='Новый email'
                        type='email'
                      />
                    )}
                  </form.Field>
                ) : (
                  <form.Field name='code'>
                    {field => (
                      <FormOtpField
                        field={field}
                        label='Код из письма'
                        length={CODE_LENGTH}
                        onComplete={() => void form.handleSubmit()}
                      />
                    )}
                  </form.Field>
                )}
              </Modal.Body>

              <Modal.Footer>
                <form.Subscribe
                  selector={s => ({
                    canSubmit: s.canSubmit,
                    isSubmitting: s.isSubmitting,
                  })}
                >
                  {({ canSubmit, isSubmitting }) => (
                    <Button
                      type='submit'
                      isDisabled={!canSubmit || isSubmitting}
                    >
                      {isSubmitting ? (
                        <Spinner />
                      ) : step === 'email' ? (
                        'Отправить код'
                      ) : (
                        'Подтвердить'
                      )}
                    </Button>
                  )}
                </form.Subscribe>
              </Modal.Footer>
            </form>
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal.Root>
  );
}
```

- [ ] **Step 5: Export from the feature barrel**

Replace `fe/src/features/user-profile/index.ts`:

```ts
export { UserEmailChangeModal } from './ui/user-email-change-modal';
export { UserProfileNameForm } from './ui/user-profile-name-form';
```

- [ ] **Step 6: Wire the modal into the profile page**

Replace `fe/src/pages/user-profile/ui/user-profile-page.tsx`:

```tsx
import { useQuery } from '@tanstack/react-query';
import { Link } from '@tanstack/react-router';

import { UserEmailChangeModal, UserProfileNameForm } from '@/features/user-profile';

import { sessionQueries } from '@/services/session';

import { ROUTES } from '@/kernel/routes';

import { Spinner, Typography } from '@/shared/ui';

export function UserProfilePage() {
  const { data: user, isPending } = useQuery(sessionQueries.me());

  if (isPending) {
    return (
      <div className='flex min-h-svh items-center justify-center'>
        <Spinner />
      </div>
    );
  }

  return (
    <div className='flex min-h-svh flex-col items-center p-4'>
      <div className='w-full max-w-md rounded-2xl border border-border bg-surface p-8 shadow-xl'>
        <Typography.Heading level={3}>Профиль</Typography.Heading>

        <div className='mt-4 flex items-center justify-between gap-3'>
          <div>
            <Typography type='body-sm' color='muted'>
              Email
            </Typography>
            <Typography className='mt-1'>{user?.email}</Typography>
          </div>
          <UserEmailChangeModal />
        </div>

        <div className='mt-6'>
          <Typography type='body-sm' color='muted'>
            Имя
          </Typography>
          <div className='mt-1'>
            <UserProfileNameForm name={user?.name ?? ''} />
          </div>
        </div>

        <Link to={ROUTES.HOME} className='mt-6 inline-block'>
          <Typography type='body-sm' className='text-accent'>
            ← На главную
          </Typography>
        </Link>
      </div>
    </div>
  );
}
```

- [ ] **Step 7: Typecheck**

Run: `cd /Users/beforedisappear/dev/home-inventory/fe && npx tsc -b`
Expected: no errors. If HeroUI `Modal`'s composed types reject any prop used above (e.g. `state` on `Modal.Root`, or `className` on `Modal.Body`), adjust by checking `node_modules/@heroui/react/dist/components/modal/modal.d.ts` for the exact prop name and fix inline — the composition (Root → Trigger + Backdrop → Container → Dialog → Header/Body/Footer) itself is confirmed correct against that file.

- [ ] **Step 8: Manual check (dev server, with Mailpit running)**

Run: `cd /Users/beforedisappear/dev/home-inventory/fe && bun run dev`
Confirm: clicking "Изменить email" opens the modal at the email step; submitting a new email advances to the code step and a message appears in Mailpit; entering the correct 6-digit code closes the modal, shows a success toast, and the profile page's email updates (re-fetch not required — cache was updated directly); reopening the modal after a previous close starts at the email step again (no leftover code entered). Stop the dev server when done.

- [ ] **Step 9: Commit**

```bash
cd /Users/beforedisappear/dev/home-inventory && git add fe/src/shared/ui/index.ts fe/src/features/user-profile fe/src/pages/user-profile/ui/user-profile-page.tsx && git commit -m "feat(fe): add email-change modal to user profile page"
```

---

### Task 5: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Lint**

Run: `cd /Users/beforedisappear/dev/home-inventory/fe && bun run lint`
Expected: no errors.

- [ ] **Step 2: Build**

Run: `cd /Users/beforedisappear/dev/home-inventory/fe && bun run build`
Expected: no errors; `dist/` produced.

- [ ] **Step 3: Full manual pass (dev server)**

Run: `cd /Users/beforedisappear/dev/home-inventory/fe && bun run dev`
Walk through the spec's Verification checklist end to end: edit name and see it persist + reflect after reload; change email end-to-end with a real code from Mailpit; verify closing/reopening the modal resets to the email step; verify `/profile` redirects unauthenticated users to `/login`; verify an authenticated user visiting `/login` is redirected home (pre-existing guard, unaffected by this feature). Stop the dev server when done.

---

## Self-Review

- **Spec coverage:** routing (`ROUTES.PROFILE`, child route, home-page link) → Task 1 ✓; `GET/PATCH /user/me`, `POST /email/request-change`, `POST /email/confirm-change` wrapped in `userQueries` with cache sync → Task 2 ✓; name edit → Task 3 ✓; 2-step email-change modal, resend-via-reopen → Task 4 ✓; generic `toast.danger` error handling → Tasks 3–4 (`catch` blocks) ✓; final lint/build/manual QA → Task 5 ✓. No backend changes, no avatar/password/delete-account UI, no resend-cooldown component — none added, per spec.
- **Placeholder scan:** none — every step has concrete, complete code or an exact command with expected output.
- **Type consistency:** `userQueries.updateName/requestEmailChange/confirmEmailChange` names match between `user.queries.ts` (Task 2) and every consumer (`use-user-profile-form.ts` Task 3, `use-user-email-change-form.ts` Task 4). `nameSchema` (Task 3) and `CODE_LENGTH`/`newEmailSchema`/`confirmCodeSchema` (Task 4) are added to the same `schemas.ts` file without renaming. `UserProfileNameForm`/`UserEmailChangeModal` export names match their barrel re-exports and the page's imports across Tasks 3–4.
- **Known adjustable:** Task 4 Step 7 flags the one genuinely untested surface (first real usage of HeroUI `Modal` in this codebase) with a concrete fallback (check the `.d.ts`, fix inline) rather than leaving it vague.
