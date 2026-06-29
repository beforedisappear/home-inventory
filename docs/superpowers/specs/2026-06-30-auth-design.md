# Авторизация (email + OTP) и защищённая домашняя — дизайн

**Дата:** 2026-06-30
**Слой:** frontend (`fe/`)

## Цель

Passwordless-вход по email + одноразовому коду, с защищённой домашней страницей. Транспортная инфраструктура (owned HTTP-клиент `apiClient`, single-flight 401-refresh, `tokenStorage`, `queryClient`, code-based роутер) уже реализована и закоммичена — здесь добавляется бизнес-слой авторизации поверх неё.

## API (из `kernel/api/schema.ts`)

| Метод/путь | Body | Ответ |
|---|---|---|
| `POST /api/v1/auth/send-code` | `LoginDto { email }` | `200 SentResponseDto { sent }` |
| `POST /api/v1/auth/authenticate` | `AuthenticateDto { email, code }` | `200 AuthTokenPairDto { accessToken, refreshToken, accessTokenExpired, refreshTokenExpired }` |
| `POST /api/v1/auth/refresh` | `RefreshTokenDto { refreshToken }` | `AuthTokenPairDto` *(уже используется в `refresh-once.ts`)* |
| `POST /api/v1/auth/logout` | `RefreshTokenDto { refreshToken }` | `204` |
| `GET /api/v1/user/me` | — | `UserResponseDto { id, email, name?, createdAt, updatedAt }` (401 без сессии) |

## Архитектура

Мэппинг FSD из пользовательского примера: `entities → services`, `features → features`. Слайсы получают публичный API через `index.ts` (как у существующих `pages/*`). Направление импортов вниз: `pages → features → services → kernel → shared`.

### Распределение по слоям

```
kernel/
  session/
    keys.ts                 # sessionKeys — query-ключи, шарятся между сервисами

services/session/           # сессия как entity: текущий пользователь + logout
  api/
    me.ts                   # meRequest()
    logout.ts               # logoutRequest()
    session.queries.ts      # namespace sessionQueries (me, logout)
  index.ts                  # export { sessionQueries }

features/auth/              # флоу входа: мутации + форма
  api/
    send-code.ts            # sendCodeRequest(dto)
    authenticate.ts         # authenticateRequest(dto)
    auth.queries.ts         # namespace authQueries (sendCode, authenticate)
  ui/
    login-form.tsx          # LoginForm — двухшаговая форма
  index.ts                  # export { LoginForm }

pages/login/ui/login-page.tsx   # рендерит <LoginForm/> (модификация placeholder'а)
pages/home/ui/home-page.tsx     # защищена: me + logout (модификация placeholder'а)

app/routes/router.tsx           # + pathless protectedRoute с guard (модификация)
shared/api/api-client.ts        # + редирект на /login при провале refresh (модификация)
```

### Фабрики (паттерн пользователя)

Request-функции — отдельные файлы, разворачивают `{ data, error }` openapi-fetch (бросают `error`, возвращают `data`). Фабрика — `namespace` в одноимённом файле сегмента `api`, импортит `apiClient`/`queryClient`/`tokenStorage` как синглтоны напрямую (без аргумента `api`). Типы DTO выводятся из `@/kernel/api/schema` (`components['schemas'][...]`).

**`kernel/session/keys.ts`**
```ts
export const sessionKeys = {
  me: () => ['session', 'me'] as const,
};
```

**`services/session/api/session.queries.ts`**
```ts
export namespace sessionQueries {
  export const me = () =>
    queryOptions({ queryKey: sessionKeys.me(), queryFn: meRequest });

  export const logout = () =>
    mutationOptions({
      mutationKey: ['session', 'logout'],
      mutationFn: logoutRequest,
      onSettled: () => {
        tokenStorage.clear();
        queryClient.clear();
      },
    });
}
```
`logoutRequest` сам читает `refreshToken` из `tokenStorage` (best-effort: нет токена → запрос не шлём). Очистка в `onSettled` — токены чистим даже при ошибке запроса.

**`features/auth/api/auth.queries.ts`**
```ts
export namespace authQueries {
  export const sendCode = () =>
    mutationOptions({ mutationFn: sendCodeRequest });

  export const authenticate = () =>
    mutationOptions({
      mutationFn: authenticateRequest,
      onSuccess: (data) =>
        tokenStorage.setTokens(data.accessToken, data.refreshToken),
    });
}
```
Навигация и переход шагов — в компоненте (router-зависимо), не в фабрике. `setQueryData(me)` после authenticate не делаем: ответ — пара токенов, не пользователь; домашняя сама подтянет `me`.

### Route guard (вариант «a» — лёгкая синхронная проверка)

Pathless layout-роут `protectedRoute` (через `id`, без `path`) с `beforeLoad`; домашняя — его ребёнок (будущие бизнес-страницы тоже под ним наследуют guard). `/login` остаётся прямым ребёнком `rootRoute`.

```ts
const protectedRoute = createRoute({
  getParentRoute: () => rootRoute,
  id: 'protected',
  beforeLoad: () => {
    if (!tokenStorage.getAccess()) throw redirect({ to: '/login' });
  },
});
// indexRoute.getParentRoute → protectedRoute
// routeTree: rootRoute.addChildren([protectedRoute.addChildren([indexRoute]), loginRoute])
```

Проверка — только наличие access-токена (синхронно, без сетевого запроса). Валидность подтверждается фактическим `me`-запросом на защищённой странице; протухший токен ловит существующий 401-middleware.

### Закрытие дыры 401-редиректа

Сейчас `api-client.ts` при провале refresh чистит токены, но не редиректит — пользователь остаётся на странице до следующей навигации. Добавляем жёсткий редирект (без импорта роутера — `shared` не зависит от `app`), с защитой от петли:

```ts
if (!refreshed) {
  tokenStorage.clear();
  if (window.location.pathname !== '/login') window.location.assign('/login');
  return response;
}
```

## Поток данных

1. **Вход.** `/login`: ввод email → `authQueries.sendCode` → `onSuccess` в компоненте переключает шаг на `code` + `toast` «код отправлен». Ввод кода → `authQueries.authenticate` → фабрика кладёт токены в `tokenStorage` → компонент `navigate({ to: '/' })`.
2. **Защищённый доступ.** `beforeLoad` видит access-токен → пускает; `sessionQueries.me` грузит пользователя. Нет токена → `redirect('/login')`.
3. **Logout.** `sessionQueries.logout` → запрос + `onSettled` чистит токены и кэш → компонент `navigate({ to: '/login' })`.
4. **Протухание посреди работы.** Любой 401 → middleware пытается refresh; провал → чистка токенов + жёсткий редирект на `/login`.

## Страницы

- **`pages/login`** — рендерит `<LoginForm/>`. Двухшаговая форма на локальном стейте (`step: 'email' | 'code'` + сохранённый email), один роут `/login`. Поля на TanStack Form + zod: email (`z.string().email()`), code (`z.string().min(1)`, trim). Кнопки с `isLoading` от `isPending` мутаций; ошибки мутаций → `toast.error`.
- **`pages/home`** — `useQuery(sessionQueries.me())`: `Spinner` при загрузке, приветствие с `email` при успехе, кнопка **Выйти** (`useMutation(sessionQueries.logout())`, по завершении `navigate('/login')`).

UI-компоненты берём из `@/shared/ui` (`Button`, `Input`, `Spinner`, `Toast`, `toast`), не из `@heroui/react` напрямую.

## Обработка ошибок

- Мутации (`sendCode`/`authenticate`/`logout`) — `toast.error` с сообщением (неверный код / не отправилось).
- `sendCode` success → переход на шаг кода (+ toast «код отправлен»).
- `me` 401 → обрабатывается middleware (refresh → при провале чистка + редирект), отдельной обработки на странице не требуется.

## Вне области (YAGNI)

- Redirect-after-login с возвратом на исходный URL (всегда → `/`).
- Auth-store / контекст сессии (вариант «c» отклонён).
- Валидация сессии запросом в `beforeLoad` (вариант «b» отклонён как избыточный).
- Регистрация, смена email, обновление профиля, темизация, app-shell/навигация.
