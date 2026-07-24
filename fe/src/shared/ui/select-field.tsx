import { Label, ListBox, Select } from '@heroui/react';

import { cn } from '@/shared/lib/cn';

interface SelectFieldOption {
  id: string;
  label: string;
}

interface SelectFieldProps {
  value: string;
  onChange: (value: string) => void;
  placeholder: string;
  options: SelectFieldOption[];
  label?: string;
  noneOption?: SelectFieldOption;
  className?: string;
}

// связывает value/onChange домена (пустая строка = "не выбрано") с Select,
// которому нужен непустой ключ — noneOption даёт этому ключу отображение
export function SelectField(props: SelectFieldProps) {
  const { value, onChange, placeholder, options, label, noneOption, className } =
    props;

  return (
    <Select.Root
      value={value || (noneOption ? noneOption.id : null)}
      onChange={key => {
        const selected = String(key);
        onChange(noneOption && selected === noneOption.id ? '' : selected);
      }}
      placeholder={placeholder}
      className={cn('flex flex-col gap-1', className)}
    >
      {label && <Label>{label}</Label>}

      <Select.Trigger>
        <Select.Value />
        <Select.Indicator />
      </Select.Trigger>

      <Select.Popover isNonModal>
        <ListBox>
          {noneOption && (
            <ListBox.Item key={noneOption.id} id={noneOption.id}>
              {noneOption.label}
            </ListBox.Item>
          )}

          {options.map(option => (
            <ListBox.Item key={option.id} id={option.id}>
              {option.label}
            </ListBox.Item>
          ))}
        </ListBox>
      </Select.Popover>
    </Select.Root>
  );
}
