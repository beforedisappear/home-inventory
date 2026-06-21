# CLAUDE.md

Guidance for Claude Code when working in the `fe/` frontend.

## Commands

The project uses **Bun** (`bun.lock`), not npm.

```bash
bun install
bun dev            # vite dev server
bun run build      # tsc -b && vite build (type-check + bundle)
bun run lint       # eslint .
bun run preview    # preview production build
```

## Stack

| Concern    | Choice                                            |
| ---------- | ------------------------------------------------- |
| UI         | React 19                                          |
| Compiler   | React Compiler (`babel-plugin-react-compiler`)    |
| Build      | Vite 8                                             |
| Language   | TypeScript 6 (bundler resolution)                 |
| Package mgr| Bun                                               |
| Lint       | ESLint 10 flat config + typescript-eslint         |

The app is fresh (Vite starter). Routing, server-state, and styling libraries are **not chosen yet** — add them deliberately and document them here when picked.

## Architecture — layered (stable dependencies)

Code lives in `src/` split into layers, ordered from **least stable** (changes often) to **most stable**:

```
app → pages → features → services → kernel → shared
(unstable, top)                          (stable, bottom)
```

**The one rule that governs everything:** a layer may import only from layers **below** it. Lower layers never import upper layers. `app` may use everything; `shared` depends on nothing above it.

| Layer        | Purpose                                                                                          | Same-layer cross-import |
| ------------ | ------------------------------------------------------------------------------------------------ | ----------------------- |
| **app**      | Entry point. Bootstrap, global config, wiring features into one app. Internal shape is app-specific. | n/a                     |
| **pages**    | Composition layer — combines several features into a screen.                                     | ❌ forbidden            |
| **features** | Main layer. Most code lives here. Each folder = one large independent piece of functionality.    | ❌ forbidden            |
| **services** | Reusable business modules. May hold both logic and view.                                          | ❌ forbidden            |
| **kernel**   | Connective business logic — knowledge of how the app is assembled.                               | ✅ allowed              |
| **shared**   | App core, used everywhere: `ui` (ui-kit), `lib` (library extensions), config objects & constants. | ✅ allowed              |

### `app/` internal structure

`app` is not standardized across projects; for this one:

- `app.tsx` — application entry: defines the root `App` component, mounts it to the DOM (`createRoot`), imports global styles. Referenced directly by `index.html` (`<script src="/src/app/app.tsx">`); there is no separate `main.tsx`.
- `providers/` — components implementing global React providers
- `routes/` — route config and router creation
- `styles/` — global CSS
- `layouts/` — reusable page layouts

## Import rules

- **Direction only downward.** `pages` may import `features`/`services`/`kernel`/`shared`; `features` may import `services`/`kernel`/`shared`; and so on. Never import a layer above the current one.
- **No same-layer cross-import** in `pages`, `features`, `services`. Two features/pages/services must not import each other — extract the shared part down into `kernel` or `shared`.
- **`kernel` and `shared` may cross-import** within their own layer.
- **Public API per slice.** Each slice (a folder under a layer) exposes its public surface via an `index.ts` barrel. Import from the slice root, never reach into another slice's internal files. This is what makes the boundary rules enforceable.

### Path alias

`@/*` → `src/*`, configured in `tsconfig.app.json` (`paths`) and `vite.config.ts` (`resolve.alias`). Import across layers with `@/<layer>/...` — e.g. `@/shared/ui`, `@/features/items`, `@/app/app`.

## React & TypeScript conventions

- **React Compiler is enabled.** Write idiomatic, pure React and let the compiler handle memoization. Do **not** hand-write `useMemo` / `useCallback` / `React.memo` for performance. Follow the Rules of React: pure render, never mutate props or state.
- **`verbatimModuleSyntax`** is on → import types with `import type { … }`.
- **`erasableSyntaxOnly`** is on → no runtime `enum` or `namespace`. Use `const` objects + union types instead.
- **`noUnusedLocals` / `noUnusedParameters`** → no dead bindings.

## Boundary enforcement

The layer/import rules above are **convention-only** today — no lint plugin enforces them yet. Optional hardening: add `eslint-plugin-boundaries` or `steiger` to fail the build on illegal cross-layer or same-layer imports.
