import type { components } from '@/kernel/api/schema';

import { ListBox, Select } from '@/shared/ui';

type ContainerRuleResponseDto =
  components['schemas']['ContainerRuleResponseDto'];

// внутренний сентинел только для отображения в Select — наружу (ContainerRuleField)
// "нет правила" всегда выходит как пустая строка, см. Global Constraints в плане
const NO_RULE_KEY = 'none';

interface Props {
  rules: ContainerRuleResponseDto[];
  value: string;
  onChange: (ruleId: string) => void;
}

export function RuleSelect({ rules, value, onChange }: Props) {
  return (
    <Select.Root
      value={value === '' ? NO_RULE_KEY : value}
      onChange={key => {
        const selected = String(key);

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
        </ListBox>
      </Select.Popover>
    </Select.Root>
  );
}
