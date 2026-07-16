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
