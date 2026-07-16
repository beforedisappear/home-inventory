import { useForm } from '@tanstack/react-form';
import { useMutation, useQuery } from '@tanstack/react-query';

import { containerQueries } from '@/services/container';
import { containerRuleQueries } from '@/services/container-rule';

import type { components } from '@/kernel/api/schema';

import { toast } from '@/shared/ui';

import { getAllowedKinds } from './get-allowed-kinds';
import { createContainerSchema } from './schemas';

type CreateContainerDto = components['schemas']['CreateContainerDto'];
type ContainerRuleResponseDto =
  components['schemas']['ContainerRuleResponseDto'];

interface UseCreateContainerFormProps {
  parentId: string | null;
  onSuccess: () => void;
  rootRules: ContainerRuleResponseDto[] | undefined;
}

export function useCreateContainerForm(props: UseCreateContainerFormProps) {
  const { parentId, onSuccess, rootRules } = props;

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

  const systemRuleId = rootRules?.find(r => r.isSystem)?.id ?? '';

  const form = useForm({
    defaultValues: { name: '', kind: '', ruleId: systemRuleId },
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
