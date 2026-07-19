import type { components } from '@/kernel/api/schema';

import { SelectField } from '@/shared/ui';

type ContainerRuleResponseDto =
  components['schemas']['ContainerRuleResponseDto'];

interface Props {
  rules: ContainerRuleResponseDto[];
  value: string;
  onChange: (ruleId: string) => void;
}

export function RuleSelect({ rules, value, onChange }: Props) {
  return (
    <SelectField
      placeholder='Выберите правило'
      value={value}
      onChange={onChange}
      options={rules.map(rule => ({
        id: rule.id,
        label: rule.isSystem ? `${rule.name} (по умолчанию)` : rule.name,
      }))}
      noneOption={{ id: 'none', label: 'Без правила' }}
    />
  );
}
