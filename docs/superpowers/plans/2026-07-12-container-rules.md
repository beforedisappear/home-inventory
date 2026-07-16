# Container Rules Mechanism Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Let the user pick a container-rule (or create a custom one inline) when creating a root container, so the previously-inert `ContainerRule`/`KindRule` backend model actually gets assigned to something.

**Architecture:** One backend DTO field (`isSystem`) so the frontend can find the seeded "Стандарт" rule without matching on display name. A new standalone `features/container-rule` slice owns rule selection + inline creation and exports a single `ContainerRuleField` component; `features/container-create` gains an optional `renderRuleField` render-prop slot (mirroring the existing `renderItemActions`/`actions` pattern) so the two features never import each other; `pages/home` wires them together.

**Tech Stack:** NestJS 11 + Mongoose (be), React 19 + TanStack Form/Query + HeroUI v3 (fe), openapi-typescript-generated types.

## Global Constraints

- FSD layering (`fe/CLAUDE.md`): a layer imports only from layers below it; **no same-layer cross-import** — `features/container-rule` and `features/container-create` must never import each other. Composition happens in `pages/`.
- Each slice exposes its public surface via `index.ts` only — never reach into another slice's internal files.
- Import HeroUI primitives via `@/shared/ui`, never `@heroui/react` directly.
- `verbatimModuleSyntax` is on → `import type { … }` for type-only imports.
- React Compiler is on → no hand-written `useMemo`/`useCallback`/`React.memo`. `useEffect` is fine for its actual purpose (syncing a default value in from an async query once).
- No test runner is wired up on the frontend, and the backend has zero `*.spec.ts` files anywhere in `src/` today (confirmed via `find be/src -name "*.spec.ts"` → 0 results). This feature follows that existing convention: verification is `build`/`lint` (type-checking) plus a manual browser walkthrough, not new automated tests.
- Rule name: 1–128 chars, mirrors `CreateContainerRuleDto` (`be/src/api/container/dto/create-container-rule.dto.ts`).
- Cross-feature contract for the rule field: `value: string` where `''` means "no rule" (mirrors `CreateContainerDto.ruleId?: string` being omitted) and any other string is a real rule id. `features/container-create` never needs to know any sentinel beyond that.

---

### Task 1: Backend — expose `isSystem` on `ContainerRuleResponseDto`

**Files:**
- Modify: `be/src/api/container/dto/container-rule-response.dto.ts`
- Modify: `be/src/api/container/mappers/container-rule.mapper.ts`

**Interfaces:**
- Produces: `ContainerRuleResponseDto.isSystem: boolean` — `true` when the rule is the seeded system rule (`ownerId === null`), consumed by Task 3's `ContainerRuleField` to auto-select "Стандарт".

- [ ] **Step 1: Add `isSystem` to the response DTO**

Edit `be/src/api/container/dto/container-rule-response.dto.ts` to:

```ts
import { IsArray, IsBoolean, IsDate, IsMongoId, IsString } from 'class-validator';

import { KindRuleDto } from './kind-rule.dto';

export class ContainerRuleResponseDto {
  @IsMongoId()
  id: string;

  @IsString()
  name: string;

  @IsBoolean()
  isSystem: boolean;

  @IsArray()
  kindRules: KindRuleDto[];

  @IsDate()
  createdAt: Date;

  @IsDate()
  updatedAt: Date;
}
```

- [ ] **Step 2: Set `isSystem` in the mapper**

Edit `be/src/api/container/mappers/container-rule.mapper.ts` to:

```ts
import { ContainerRuleResponseDto } from '../dto/container-rule-response.dto';
import { ContainerRuleDocument } from '../schemas/container-rule.schema';

export class ContainerRuleMapper {
  static toResponseDto(doc: ContainerRuleDocument): ContainerRuleResponseDto {
    return {
      id: doc._id.toString(),
      name: doc.name,
      isSystem: doc.ownerId === null,
      // Mongoose subdoc-array — копируем чистыми объектами, без internal-полей
      kindRules: doc.kindRules.map((kr) => ({
        kind: kr.kind,
        canBeInsideRoot: kr.canBeInsideRoot,
        allowedParents: [...kr.allowedParents],
      })),
      createdAt: doc.createdAt,
      updatedAt: doc.updatedAt,
    };
  }
}
```

- [ ] **Step 3: Build to verify**

Run: `cd be && npm run build`
Expected: exits 0, no TypeScript errors.

- [ ] **Step 4: Commit**

```bash
git add be/src/api/container/dto/container-rule-response.dto.ts be/src/api/container/mappers/container-rule.mapper.ts
git commit -m "feat(be): expose isSystem on ContainerRuleResponseDto"
```

---

### Task 2: Frontend — regenerate API types, extend `container-rule` service (list + create)

**Files:**
- Modify: `fe/src/kernel/api/schema.ts` (regenerated, not hand-edited)
- Create: `fe/src/services/container-rule/api/find-all.ts`
- Create: `fe/src/services/container-rule/api/create.ts`
- Modify: `fe/src/services/container-rule/api/container-rule.queries.ts`
- Modify: `fe/src/kernel/container/keys.ts`

**Interfaces:**
- Consumes: Task 1's `ContainerRuleResponseDto.isSystem`.
- Produces: `containerRuleQueries.list()` (queryOptions), `containerRuleQueries.create()` (mutationOptions), `buildContainerRuleListKey()` — consumed by Task 3's `ContainerRuleField`/`useCreateRuleForm`.

- [ ] **Step 1: Start the backend with Task 1's change live**

Run: `cd be && docker compose up -d && npm run start:dev`
Expected: server logs listening on port 3000 (leave running in the background for the next step; e.g. run this in a separate terminal/background job).

- [ ] **Step 2: Regenerate the frontend OpenAPI schema**

Run: `cd fe && bun run api:sync`
Expected: `src/kernel/api/schema.ts` is rewritten; `components['schemas']['ContainerRuleResponseDto']` now includes `isSystem: boolean`. Verify with:

```bash
grep -A6 "ContainerRuleResponseDto:" fe/src/kernel/api/schema.ts
```
Expected output includes `isSystem: boolean;`.

- [ ] **Step 3: Add the list request**

Create `fe/src/services/container-rule/api/find-all.ts`:

```ts
import type { components } from '@/kernel/api/schema';
import { apiClient } from '@/shared/api/api-client';

type ContainerRuleResponseDto =
  components['schemas']['ContainerRuleResponseDto'];

export async function findAllContainerRulesRequest(): Promise<
  ContainerRuleResponseDto[]
> {
  const { data, error } = await apiClient.GET('/api/v1/container-rules');

  if (error) throw error;

  return data!;
}
```

- [ ] **Step 4: Add the create request**

Create `fe/src/services/container-rule/api/create.ts`:

```ts
import type { components } from '@/kernel/api/schema';
import { apiClient } from '@/shared/api/api-client';

type CreateContainerRuleDto = components['schemas']['CreateContainerRuleDto'];
type ContainerRuleResponseDto =
  components['schemas']['ContainerRuleResponseDto'];

export async function createContainerRuleRequest(
  dto: CreateContainerRuleDto,
): Promise<ContainerRuleResponseDto> {
  const { data, error } = await apiClient.POST('/api/v1/container-rules', {
    body: dto,
  });

  if (error) throw error;

  return data!;
}
```

- [ ] **Step 5: Add the list-key builder**

Edit `fe/src/kernel/container/keys.ts` to:

```ts
export const buildContainerChildrenKey = (parentId: string | null) =>
  ['container', 'children', parentId] as const;

export const buildContainerByIdKey = (id: string) => ['container', id] as const;

export const buildContainerRuleByIdKey = (id: string) =>
  ['container-rule', id] as const;

export const buildContainerRuleListKey = () =>
  ['container-rule', 'list'] as const;
```

- [ ] **Step 6: Wire `list()` and `create()` into `containerRuleQueries`**

Edit `fe/src/services/container-rule/api/container-rule.queries.ts` to:

```ts
import { mutationOptions, queryOptions } from '@tanstack/react-query';

import {
  buildContainerRuleByIdKey,
  buildContainerRuleListKey,
} from '@/kernel/container/keys';

import { queryClient } from '@/shared/api/query-client';

import { createContainerRuleRequest } from './create';
import { findAllContainerRulesRequest } from './find-all';
import { findContainerRuleByIdRequest } from './find-by-id';

export const containerRuleQueries = {
  byId: (id: string) =>
    queryOptions({
      queryKey: buildContainerRuleByIdKey(id),
      queryFn: () => findContainerRuleByIdRequest(id),
    }),

  list: () =>
    queryOptions({
      queryKey: buildContainerRuleListKey(),
      queryFn: findAllContainerRulesRequest,
    }),

  create: () =>
    mutationOptions({
      mutationFn: createContainerRuleRequest,
      onSuccess: () => {
        queryClient.invalidateQueries({
          queryKey: buildContainerRuleListKey(),
        });
      },
    }),
};
```

- [ ] **Step 7: Typecheck to verify**

Run: `cd fe && bun run build`
Expected: exits 0, no TypeScript errors.

- [ ] **Step 8: Commit**

```bash
git add fe/src/kernel/api/schema.ts fe/src/kernel/container/keys.ts fe/src/services/container-rule
git commit -m "feat(fe): container-rule list/create requests"
```

---

### Task 3: Frontend — `features/container-rule` slice (select, inline create, default selection)

**Files:**
- Modify: `fe/src/shared/ui/index.ts` (export `Checkbox`)
- Modify: `fe/src/kernel/container/kind-label.ts` (export `CONTAINER_KINDS`)
- Create: `fe/src/features/container-rule/ui/rule-select.tsx`
- Create: `fe/src/features/container-rule/model/use-create-rule-form.ts`
- Create: `fe/src/features/container-rule/ui/create-rule-form.tsx`
- Create: `fe/src/features/container-rule/ui/container-rule-field.tsx`
- Create: `fe/src/features/container-rule/index.ts`

**Interfaces:**
- Consumes: `containerRuleQueries.list()`/`.create()` from Task 2; `CONTAINER_KINDS`/`getContainerKindLabel` (this task's own kernel addition); `Checkbox`, `ListBox`, `Select`, `Button`, `FormTextField`, `Spinner`, `Typography`, `toast` from `@/shared/ui`.
- Produces: `ContainerRuleField({ value: string; onChange: (ruleId: string) => void })` — exported as the slice's only public symbol, consumed by Task 4's `renderRuleField` slot.

- [ ] **Step 1: Export `Checkbox` from the shared ui-kit**

Edit `fe/src/shared/ui/index.ts` — add `Checkbox` to the `@heroui/react` re-export list:

```ts
// единая точка ui-kit: фичи берут компоненты отсюда, не из @heroui/react напрямую
export {
  AlertDialog,
  Button,
  Checkbox,
  Chip,
  Dropdown,
  ErrorMessage,
  Input,
  Label,
  ListBox,
  Modal,
  Select,
  Skeleton,
  Spinner,
  TextField,
  Toast,
  Tooltip,
  Typography,
  toast,
  useOverlayState,
  type UseOverlayStateReturn,
} from '@heroui/react';

export { Brand } from './brand';
export { EmptyState } from './empty-state';
export { ErrorState } from './error-state';
export { FormOtpField } from './form-otp-field';
export { FormTextField } from './form-text-field';
export { ThemeToggle } from './theme-toggle';
```

- [ ] **Step 2: Export the ordered kind list from kernel**

Edit `fe/src/kernel/container/kind-label.ts` to:

```ts
import type { components } from '@/kernel/api/schema';

type ContainerKind = components['schemas']['ContainerResponseDto']['kind'];

const CONTAINER_KIND_LABEL = {
  room: 'Комната',
  cabinet: 'Шкаф',
  drawer: 'Ящик',
  box: 'Коробка',
  bag: 'Сумка',
} as const;

export const CONTAINER_KINDS = Object.keys(
  CONTAINER_KIND_LABEL,
) as (keyof typeof CONTAINER_KIND_LABEL)[];

export function getContainerKindLabel(kind: ContainerKind) {
  return kind ? CONTAINER_KIND_LABEL[kind] : null;
}
```

- [ ] **Step 3: Write `RuleSelect`**

Create `fe/src/features/container-rule/ui/rule-select.tsx`:

```tsx
import type { components } from '@/kernel/api/schema';

import { ListBox, Select } from '@/shared/ui';

type ContainerRuleResponseDto =
  components['schemas']['ContainerRuleResponseDto'];

// внутренний сентинел только для отображения в Select — наружу (ContainerRuleField)
// "нет правила" всегда выходит как пустая строка, см. Global Constraints в плане
const NO_RULE_KEY = 'none';
const CREATE_ACTION_KEY = '__create__';

interface Props {
  rules: ContainerRuleResponseDto[];
  value: string;
  onChange: (ruleId: string) => void;
  onRequestCreate: () => void;
}

export function RuleSelect({ rules, value, onChange, onRequestCreate }: Props) {
  return (
    <Select.Root
      selectedKey={value === '' ? NO_RULE_KEY : value}
      onSelectionChange={key => {
        const selected = String(key);

        if (selected === CREATE_ACTION_KEY) {
          onRequestCreate();
          return;
        }

        onChange(selected === NO_RULE_KEY ? '' : selected);
      }}
      placeholder='Выберите правило'
      className='flex flex-col gap-1'
    >
      <Select.Trigger className='flex items-center justify-between gap-2 rounded-lg border border-field-border bg-field-background px-3 py-2'>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>
      <Select.Popover isNonModal>
        <ListBox>
          {rules.map(rule => (
            <ListBox.Item key={rule.id} id={rule.id}>
              {rule.isSystem ? `${rule.name} (по умолчанию)` : rule.name}
            </ListBox.Item>
          ))}
          <ListBox.Item key={NO_RULE_KEY} id={NO_RULE_KEY}>
            Без правила
          </ListBox.Item>
          <ListBox.Item key={CREATE_ACTION_KEY} id={CREATE_ACTION_KEY}>
            + Создать своё правило
          </ListBox.Item>
        </ListBox>
      </Select.Popover>
    </Select.Root>
  );
}
```

- [ ] **Step 4: Write the create-rule-form model hook**

Create `fe/src/features/container-rule/model/use-create-rule-form.ts`:

```ts
import { useForm } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';

import { containerRuleQueries } from '@/services/container-rule';

import type { components } from '@/kernel/api/schema';

import { CONTAINER_KINDS } from '@/kernel/container/kind-label';

import { toast } from '@/shared/ui';

type ContainerKind = (typeof CONTAINER_KINDS)[number];
type KindRuleDto = components['schemas']['KindRuleDto'];

export interface KindRuleRow {
  enabled: boolean;
  canBeInsideRoot: boolean;
  allowedParents: ContainerKind[];
}

export type KindRulesFormValue = Record<ContainerKind, KindRuleRow>;

function buildDefaultKindRulesFormValue(): KindRulesFormValue {
  const value = {} as KindRulesFormValue;

  for (const kind of CONTAINER_KINDS) {
    value[kind] = { enabled: false, canBeInsideRoot: false, allowedParents: [] };
  }

  return value;
}

interface UseCreateRuleFormProps {
  onCreated: (ruleId: string) => void;
}

// матрица по 5 kind'ам: "включён ли kind в правило" + "можно в root" + "разрешённые родители"
export function useCreateRuleForm({ onCreated }: UseCreateRuleFormProps) {
  const { mutateAsync: createRule } = useMutation(
    containerRuleQueries.create(),
  );

  const form = useForm({
    defaultValues: {
      name: '',
      kindRules: buildDefaultKindRulesFormValue(),
    },
    onSubmit: async ({ value }) => {
      const kindRules: KindRuleDto[] = CONTAINER_KINDS.filter(
        kind => value.kindRules[kind].enabled,
      ).map(kind => ({
        kind,
        canBeInsideRoot: value.kindRules[kind].canBeInsideRoot,
        allowedParents: value.kindRules[kind].allowedParents,
      }));

      try {
        const created = await createRule({ name: value.name, kindRules });
        toast.success('Правило создано');
        onCreated(created.id);
      } catch (err) {
        const statusCode =
          err && typeof err === 'object' && 'statusCode' in err
            ? (err as { statusCode?: number }).statusCode
            : undefined;

        toast.danger(
          statusCode === 409
            ? `Правило с именем «${value.name}» уже существует`
            : 'Не удалось создать правило',
        );
      }
    },
  });

  return { form };
}
```

- [ ] **Step 5: Write `CreateRuleForm`**

Create `fe/src/features/container-rule/ui/create-rule-form.tsx`:

```tsx
import { CONTAINER_KINDS, getContainerKindLabel } from '@/kernel/container/kind-label';

import { Button, Checkbox, FormTextField, Spinner, Typography } from '@/shared/ui';

import { useCreateRuleForm } from '../model/use-create-rule-form';

interface Props {
  onCreated: (ruleId: string) => void;
  onCancel: () => void;
}

// type="button" везде — этот блок рендерится внутри внешнего <form> контейнера
// (create-container-form.tsx), вложенный <form> был бы невалидным HTML
export function CreateRuleForm({ onCreated, onCancel }: Props) {
  const { form } = useCreateRuleForm({ onCreated });

  return (
    <div className='flex flex-col gap-3'>
      <form.Field name='name'>
        {field => <FormTextField field={field} label='Название правила' />}
      </form.Field>

      <div className='flex flex-col gap-2'>
        {CONTAINER_KINDS.map(kind => (
          <form.Field key={kind} name={`kindRules.${kind}`}>
            {field => {
              const row = field.state.value;

              return (
                <div className='flex flex-col gap-1.5 rounded-lg border border-border p-2'>
                  <Checkbox.Root
                    isSelected={row.enabled}
                    onChange={enabled => field.handleChange({ ...row, enabled })}
                  >
                    <Checkbox.Content>
                      <Checkbox.Control>
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                      {getContainerKindLabel(kind)}
                    </Checkbox.Content>
                  </Checkbox.Root>

                  {row.enabled && (
                    <div className='flex flex-col gap-1 pl-6'>
                      <Checkbox.Root
                        isSelected={row.canBeInsideRoot}
                        onChange={canBeInsideRoot =>
                          field.handleChange({ ...row, canBeInsideRoot })
                        }
                      >
                        <Checkbox.Content>
                          <Checkbox.Control>
                            <Checkbox.Indicator />
                          </Checkbox.Control>
                          Можно в root
                        </Checkbox.Content>
                      </Checkbox.Root>

                      <Typography type='body-sm' color='muted'>
                        Разрешённые родители
                      </Typography>

                      <div className='flex flex-wrap gap-2'>
                        {CONTAINER_KINDS.filter(parent => parent !== kind).map(
                          parent => (
                            <Checkbox.Root
                              key={parent}
                              isSelected={row.allowedParents.includes(parent)}
                              onChange={isSelected =>
                                field.handleChange({
                                  ...row,
                                  allowedParents: isSelected
                                    ? [...row.allowedParents, parent]
                                    : row.allowedParents.filter(p => p !== parent),
                                })
                              }
                            >
                              <Checkbox.Content>
                                <Checkbox.Control>
                                  <Checkbox.Indicator />
                                </Checkbox.Control>
                                {getContainerKindLabel(parent)}
                              </Checkbox.Content>
                            </Checkbox.Root>
                          ),
                        )}
                      </div>
                    </div>
                  )}
                </div>
              );
            }}
          </form.Field>
        ))}
      </div>

      <form.Subscribe
        selector={state => ({
          name: state.values.name,
          kindRules: state.values.kindRules,
          isSubmitting: state.isSubmitting,
        })}
      >
        {({ name, kindRules, isSubmitting }) => {
          const enabledKinds = CONTAINER_KINDS.filter(
            kind => kindRules[kind].enabled,
          );
          const hasDeadRow = enabledKinds.some(kind => {
            const row = kindRules[kind];
            return !row.canBeInsideRoot && row.allowedParents.length === 0;
          });
          const canSubmit =
            name.trim().length > 0 && enabledKinds.length > 0 && !hasDeadRow;

          return (
            <div className='mt-auto flex gap-2'>
              <Button
                type='button'
                variant='ghost'
                className='flex-1'
                onPress={onCancel}
              >
                Отмена
              </Button>
              <Button
                type='button'
                className='flex-1'
                isDisabled={!canSubmit || isSubmitting}
                onPress={() => void form.handleSubmit()}
              >
                {isSubmitting ? <Spinner /> : 'Создать'}
              </Button>
            </div>
          );
        }}
      </form.Subscribe>
    </div>
  );
}
```

- [ ] **Step 6: Write `ContainerRuleField`**

Create `fe/src/features/container-rule/ui/container-rule-field.tsx`:

```tsx
import { useEffect, useRef, useState } from 'react';

import { useQuery } from '@tanstack/react-query';

import { containerRuleQueries } from '@/services/container-rule';

import { Typography } from '@/shared/ui';

import { CreateRuleForm } from './create-rule-form';
import { RuleSelect } from './rule-select';

interface Props {
  value: string;
  onChange: (ruleId: string) => void;
}

// value === '' значит "нет правила" — тот же контракт, что у CreateContainerDto.ruleId.
// Публичный компонент фичи: остальные файлы этого слайса — детали реализации.
export function ContainerRuleField({ value, onChange }: Props) {
  const [mode, setMode] = useState<'select' | 'create'>('select');
  const { data: rules = [] } = useQuery(containerRuleQueries.list());

  // один раз, когда список правил загрузился — подставляем системное "Стандарт"
  // как значение по умолчанию. hasDefaulted гарантирует, что явный выбор юзера
  // (в т.ч. "Без правила", которое тоже кодируется как '') не будет затёрт повторно
  const hasDefaulted = useRef(false);

  useEffect(() => {
    if (hasDefaulted.current || rules.length === 0) return;

    hasDefaulted.current = true;

    if (value === '') {
      const systemRule = rules.find(rule => rule.isSystem);
      if (systemRule) onChange(systemRule.id);
    }
  }, [rules, value, onChange]);

  return (
    <div className='flex flex-col gap-1'>
      <Typography type='body-sm' color='muted'>
        Правило размещения
      </Typography>

      {mode === 'select' ? (
        <RuleSelect
          rules={rules}
          value={value}
          onChange={onChange}
          onRequestCreate={() => setMode('create')}
        />
      ) : (
        <CreateRuleForm
          onCreated={ruleId => {
            onChange(ruleId);
            setMode('select');
          }}
          onCancel={() => setMode('select')}
        />
      )}
    </div>
  );
}
```

- [ ] **Step 7: Write the barrel**

Create `fe/src/features/container-rule/index.ts`:

```ts
export { ContainerRuleField } from './ui/container-rule-field';
```

- [ ] **Step 8: Typecheck and lint to verify**

Run: `cd fe && bun run build && bun run lint`
Expected: both exit 0, no errors.

- [ ] **Step 9: Commit**

```bash
git add fe/src/shared/ui/index.ts fe/src/kernel/container/kind-label.ts fe/src/features/container-rule
git commit -m "feat(fe): container-rule feature — select + inline create"
```

---

### Task 4: Frontend — wire `ContainerRuleField` into container creation

**Files:**
- Modify: `fe/src/features/container-create/ui/create-container-form.tsx`
- Modify: `fe/src/features/container-create/ui/create-container.tsx`
- Modify: `fe/src/features/container-create/model/use-create-container-form.ts`
- Modify: `fe/src/pages/home/ui/home-page.tsx`

**Interfaces:**
- Consumes: `ContainerRuleField` from Task 3 (imported only in `pages/home`, never inside `features/container-create`).
- Produces: `CreateContainerForm`'s `renderRuleField` prop is the only new public surface; no other slice depends on it.

- [ ] **Step 1: Add the `renderRuleField` slot to `CreateContainerForm`**

Edit `fe/src/features/container-create/ui/create-container-form.tsx` to:

```tsx
import type { ReactNode } from 'react';

import { getContainerKindLabel } from '@/kernel/container/kind-label';

import {
  Button,
  FormTextField,
  ListBox,
  Select,
  Spinner,
  Typography,
} from '@/shared/ui';

import { useCreateContainerForm } from '../model/use-create-container-form';

interface Props {
  parentId: string | null;
  onSuccess: () => void;
  renderRuleField?: (props: {
    value: string;
    onChange: (ruleId: string) => void;
  }) => ReactNode;
}

export function CreateContainerForm({
  parentId,
  onSuccess,
  renderRuleField,
}: Props) {
  const { form, allowedKinds } = useCreateContainerForm({
    parentId,
    onSuccess,
  });

  const isDeadEnd = parentId !== null && allowedKinds.length === 0;

  return (
    <form
      className='flex flex-col gap-3 pt-4 flex-1'
      onSubmit={e => {
        e.preventDefault();
        e.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <form.Field name='name'>
        {field => <FormTextField field={field} label='Название' />}
      </form.Field>

      {parentId === null && renderRuleField && (
        <form.Field name='ruleId'>
          {field =>
            renderRuleField({
              value: field.state.value,
              onChange: field.handleChange,
            })
          }
        </form.Field>
      )}

      {parentId !== null && !isDeadEnd && (
        <form.Field name='kind'>
          {field => (
            <Select.Root
              selectedKey={field.state.value || null}
              onSelectionChange={key => field.handleChange(String(key))}
              placeholder='Выберите тип'
              className='flex flex-col gap-1'
            >
              <Select.Trigger className='flex items-center justify-between gap-2 rounded-lg border border-field-border bg-field-background px-3 py-2'>
                <Select.Value />
                <Select.Indicator />
              </Select.Trigger>
              <Select.Popover isNonModal>
                <ListBox>
                  {allowedKinds.map(kind => (
                    <ListBox.Item key={kind} id={kind}>
                      {getContainerKindLabel(kind)}
                    </ListBox.Item>
                  ))}
                </ListBox>
              </Select.Popover>
            </Select.Root>
          )}
        </form.Field>
      )}

      {isDeadEnd && (
        <Typography type='body-sm' color='muted'>
          Внутрь этого контейнера ничего нельзя добавить.
        </Typography>
      )}

      <form.Subscribe
        selector={state => ({
          canSubmit: state.canSubmit,
          isSubmitting: state.isSubmitting,
          kind: state.values.kind,
        })}
      >
        {({ canSubmit, isSubmitting, kind }) => (
          <Button
            type='submit'
            className='mt-auto w-full'
            isDisabled={
              !canSubmit ||
              isSubmitting ||
              isDeadEnd ||
              (parentId !== null && !kind)
            }
          >
            {isSubmitting ? <Spinner /> : 'Создать'}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
```

- [ ] **Step 2: Forward the slot through `CreateContainer`**

Edit `fe/src/features/container-create/ui/create-container.tsx` to:

```tsx
import type { ReactNode } from 'react';

import { Plus } from 'lucide-react';

import { Button, useOverlayState } from '@/shared/ui';

import { CreateContainerForm } from './create-container-form';
import { CreateContainerModal } from './create-container-modal';

interface Props {
  parentId: string | null;
  renderRuleField?: (props: {
    value: string;
    onChange: (ruleId: string) => void;
  }) => ReactNode;
}

export function CreateContainer({ parentId, renderRuleField }: Props) {
  const state = useOverlayState();

  return (
    <>
      <Button
        type='button'
        isIconOnly
        size='sm'
        aria-label='Добавить контейнер'
        onPress={state.open}
      >
        <Plus size={16} />
      </Button>

      <CreateContainerModal state={state}>
        <CreateContainerForm
          parentId={parentId}
          onSuccess={state.close}
          renderRuleField={renderRuleField}
        />
      </CreateContainerModal>
    </>
  );
}
```

- [ ] **Step 3: Add `ruleId` to the create-container form model**

Edit `fe/src/features/container-create/model/use-create-container-form.ts` to:

```ts
import { useForm } from '@tanstack/react-form';
import { useMutation, useQuery } from '@tanstack/react-query';

import { containerQueries } from '@/services/container';
import { containerRuleQueries } from '@/services/container-rule';

import type { components } from '@/kernel/api/schema';

import { toast } from '@/shared/ui';

import { getAllowedKinds } from './get-allowed-kinds';
import { createContainerSchema } from './schemas';

type CreateContainerDto = components['schemas']['CreateContainerDto'];

interface UseCreateContainerFormProps {
  parentId: string | null;
  onSuccess: () => void;
}

// root (parentId === null) — имя + опционально ruleId. child — имя + kind, список kind сужен
// по правилу родителя (см. get-allowed-kinds.ts)
export function useCreateContainerForm(props: UseCreateContainerFormProps) {
  const { parentId, onSuccess } = props;

  const { data: parent } = useQuery({
    ...containerQueries.byId(parentId ?? ''),
    enabled: !!parentId,
  });

  const { data: rule } = useQuery({
    ...containerRuleQueries.byId(parent?.ruleId ?? ''),
    enabled: !!parent?.ruleId,
  });

  const allowedKinds = parentId
    ? getAllowedKinds(parent?.kind ?? null, rule ?? null)
    : [];

  const { mutateAsync: createContainer } = useMutation(
    containerQueries.create(),
  );

  const form = useForm({
    defaultValues: { name: '', kind: '', ruleId: '' },
    validators: { onSubmit: createContainerSchema },
    onSubmit: async ({ value }) => {
      try {
        await createContainer({
          name: value.name,
          parentId: parentId ?? undefined,
          kind: parentId
            ? (value.kind as CreateContainerDto['kind'])
            : undefined,
          ruleId: parentId === null ? value.ruleId || undefined : undefined,
        });
        toast.success('Контейнер создан');
        onSuccess();
      } catch {
        toast.danger('Не удалось создать контейнер');
      }
    },
  });

  return { form, allowedKinds };
}
```

- [ ] **Step 4: Wire `ContainerRuleField` into the root-creation call site**

Edit `fe/src/pages/home/ui/home-page.tsx` to:

```tsx
import { CreateContainer } from '@/features/container-create';
import { ContainerRuleField } from '@/features/container-rule';
import {
  ContainerDeleteDialog,
  ContainerDeleteTrigger,
} from '@/features/container-delete';
import { ContainerList } from '@/features/container-list';

import { Typography } from '@/shared/ui';

export function HomePage() {
  return (
    <div className='flex flex-1 flex-col items-center p-4'>
      <div className='flex w-full max-w-2xl flex-1 flex-col gap-6'>
        <div className='flex items-center justify-between gap-2 border-b border-border pb-4'>
          <Typography.Heading level={2}>Мои контейнеры</Typography.Heading>
          <CreateContainer
            parentId={null}
            renderRuleField={props => <ContainerRuleField {...props} />}
          />
        </div>

        <ContainerList
          parentId={null}
          renderItemActions={child => (
            <ContainerDeleteTrigger
              containerId={child.id}
              parentId={null}
              containerName={child.name}
            />
          )}
        />
      </div>

      <ContainerDeleteDialog />
    </div>
  );
}
```

`fe/src/pages/container-by-id/ui/container-by-id-page.tsx` needs no change — its `CreateContainer` call always creates children (`parentId={container.id}`), so `renderRuleField` stays unset there and the root-only slot never renders.

- [ ] **Step 5: Typecheck and lint to verify**

Run: `cd fe && bun run build && bun run lint`
Expected: both exit 0, no errors.

- [ ] **Step 6: Commit**

```bash
git add fe/src/features/container-create fe/src/pages/home/ui/home-page.tsx
git commit -m "feat(fe): wire container-rule field into root container creation"
```

---

### Task 5: Final verification

**Files:** none (verification only).

- [ ] **Step 1: Backend build + lint**

Run: `cd be && npm run build && npm run lint`
Expected: both exit 0.

- [ ] **Step 2: Frontend build + lint**

Run: `cd fe && bun run build && bun run lint`
Expected: both exit 0.

- [ ] **Step 3: Manual walkthrough — default selection**

With `be` running (`docker compose up -d && npm run start:dev`) and `fe` running (`bun dev`):
1. Open the home page, click the FAB to open "Новый контейнер".
2. Confirm "Правило размещения" is visible and pre-selects "Стандарт (по умолчанию)" once it loads.
3. Enter a name, submit. Confirm the container is created (toast "Контейнер создан", list updates).

Expected: root container created with the "Стандарт" rule applied — verify by opening it and confirming the child-creation kind list is narrowed to what "Стандарт" allows at root (`room` only).

- [ ] **Step 4: Manual walkthrough — "Без правила"**

1. Open "Новый контейнер" again, switch the rule select to "Без правила", enter a name, submit.
2. Open the new container, open its child "Новый контейнер" — confirm the kind select is unrestricted (all 5 kinds available), matching `getAllowedKinds`'s `rule === null` branch.

- [ ] **Step 5: Manual walkthrough — inline rule creation**

1. Open "Новый контейнер", pick "+ Создать своё правило".
2. Confirm the "Название" field's current value is untouched and the modal doesn't remount.
3. Fill in a rule name, enable `room` with "можно в root" checked, enable `cabinet` with allowed parent `room`. Confirm "Создать" (matrix form) is disabled until at least one kind is enabled and no enabled row is dead (neither "можно в root" nor any allowed parent).
4. Submit the matrix form. Confirm the field switches back to select mode with the new rule selected and named correctly.
5. Submit the outer "Создать" button. Confirm the root container is created with the new rule.
6. Open it, open its child creation — confirm the kind list matches exactly what the new custom rule allows at root.

- [ ] **Step 6: Manual walkthrough — duplicate rule name**

1. Repeat step 5.1–5.3 using the exact same rule name as an already-created custom rule.
2. Submit. Expect a toast: `Правило с именем «<name>» уже существует`, and the form stays in create mode (no navigation, no container created).

- [ ] **Step 7: Regression check — child container creation unaffected**

Create a child container under any existing container as before this feature (no rule field should appear for children). Confirm it still works exactly as it did pre-feature.

- [ ] **Step 8: Report results to the user**

Summarize pass/fail for each walkthrough step; do not mark this task complete if any step fails — go back to the relevant earlier task and fix.
