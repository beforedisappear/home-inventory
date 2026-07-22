import { useState } from 'react';
import type { AnyFieldApi } from '@tanstack/react-form';
import {
  Button,
  Checkbox,
  ErrorMessage,
  Input,
  Label,
  Popover,
  TextField,
} from '@heroui/react';
import { Pencil, Plus, X } from 'lucide-react';

import { SelectField } from '@/shared/ui';

import {
  CUSTOM_FIELD_TYPES,
  CUSTOM_FIELD_TYPE_LABELS,
  getCustomFieldRowError,
  type CustomFieldFormValue,
} from '../model/custom-fields-schema';

interface Props {
  field: AnyFieldApi;
}

const TYPE_OPTIONS = CUSTOM_FIELD_TYPES.map(type => ({
  id: type,
  label: CUSTOM_FIELD_TYPE_LABELS[type],
}));

function defaultValueFor(type: CustomFieldFormValue['type']): string {
  return type === 'boolean' ? 'false' : '';
}

interface NameTypeFormProps {
  initialKey: string;
  initialType: CustomFieldFormValue['type'];
  onSave: (key: string, type: CustomFieldFormValue['type']) => void;
  onClose: () => void;
}

// попап меняет только "структуру" поля (название/тип) — правится редко.
// значение самого поля правится инлайн в строке, отдельным native-контролом
function CustomFieldNameTypeForm(props: NameTypeFormProps) {
  const { initialKey, initialType, onSave, onClose } = props;
  const [key, setKey] = useState(initialKey);
  const [type, setType] = useState(initialType);

  const trimmedKey = key.trim();
  const error =
    trimmedKey === ''
      ? 'Укажите название поля'
      : trimmedKey.length > 64
        ? 'Слишком длинное название'
        : null;

  return (
    <div className='flex w-64 flex-col gap-3'>
      <TextField
        value={key}
        onChange={setKey}
        isInvalid={Boolean(error)}
        aria-label='Название поля'
      >
        <Input placeholder='Название' />
      </TextField>

      {error && <ErrorMessage>{error}</ErrorMessage>}

      <SelectField
        value={type}
        onChange={value => setType(value as CustomFieldFormValue['type'])}
        placeholder='Тип'
        options={TYPE_OPTIONS}
      />

      <div className='flex justify-end gap-2'>
        <Button type='button' variant='ghost' size='sm' onPress={onClose}>
          Отмена
        </Button>
        <Button
          type='button'
          size='sm'
          isDisabled={Boolean(error)}
          onPress={() => {
            onSave(trimmedKey, type);
            onClose();
          }}
        >
          Сохранить
        </Button>
      </div>
    </div>
  );
}

export function CustomFieldsField(props: Props) {
  const { field } = props;
  const rows: CustomFieldFormValue[] = field.state.value;

  const [editIndex, setEditIndex] = useState<number | null>(null);
  const [isAddOpen, setIsAddOpen] = useState(false);

  const updateValue = (index: number, value: string) => {
    field.handleChange((current: CustomFieldFormValue[]) =>
      current.map((row, i) => (i === index ? { ...row, value } : row)),
    );
  };

  const updateNameType = (
    index: number,
    key: string,
    type: CustomFieldFormValue['type'],
  ) => {
    field.handleChange((current: CustomFieldFormValue[]) =>
      current.map((row, i) => {
        if (i !== index) return row;
        // смена типа обнуляет значение — старое значение может не подходить новому типу
        return row.type === type
          ? { ...row, key }
          : { ...row, key, type, value: defaultValueFor(type) };
      }),
    );
  };

  const handleAdd = (key: string, type: CustomFieldFormValue['type']) => {
    field.handleChange((current: CustomFieldFormValue[]) => [
      ...current,
      { key, type, value: defaultValueFor(type) },
    ]);
  };

  const handleRemove = (index: number) => {
    field.handleChange((current: CustomFieldFormValue[]) =>
      current.filter((_, i) => i !== index),
    );
  };

  return (
    <div className='flex flex-col gap-2'>
      <div className='flex flex-col gap-2'>
        {rows.map((row, index) => {
          const error = getCustomFieldRowError(row);

          const actions = (
            <div className='flex shrink-0 items-center gap-1'>
              <Popover.Root
                isOpen={editIndex === index}
                onOpenChange={isOpen => setEditIndex(isOpen ? index : null)}
              >
                <Popover.Trigger
                  aria-label='Название и тип поля'
                  className='flex size-8 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-secondary hover:text-foreground'
                >
                  <Pencil size={16} />
                </Popover.Trigger>

                <Popover.Content>
                  <Popover.Dialog>
                    <CustomFieldNameTypeForm
                      initialKey={row.key}
                      initialType={row.type}
                      onSave={(key, type) => updateNameType(index, key, type)}
                      onClose={() => setEditIndex(null)}
                    />
                  </Popover.Dialog>
                </Popover.Content>
              </Popover.Root>

              <button
                type='button'
                aria-label='Удалить поле'
                onClick={() => handleRemove(index)}
                className='flex size-8 items-center justify-center rounded-lg text-muted transition-colors hover:text-danger'
              >
                <X size={16} />
              </button>
            </div>
          );

          return (
            <div key={index} className='flex flex-col gap-1.5'>
              {row.type === 'boolean' ? (
                <div className='flex items-center justify-between gap-2'>
                  <Checkbox.Root
                    isSelected={row.value === 'true'}
                    onChange={isSelected =>
                      updateValue(index, isSelected ? 'true' : 'false')
                    }
                  >
                    <Checkbox.Content>
                      <Checkbox.Control>
                        <Checkbox.Indicator />
                      </Checkbox.Control>
                      {row.key || 'Без названия'}
                    </Checkbox.Content>
                  </Checkbox.Root>

                  {actions}
                </div>
              ) : (
                <>
                  <div className='flex items-center justify-between gap-2'>
                    <Label className='truncate'>
                      {row.key || 'Без названия'}
                    </Label>
                    {actions}
                  </div>

                  <TextField
                    type={
                      row.type === 'number'
                        ? 'number'
                        : row.type === 'date'
                          ? 'date'
                          : 'text'
                    }
                    value={row.value}
                    onChange={value => updateValue(index, value)}
                    isInvalid={Boolean(error)}
                    aria-label={`Значение поля ${row.key}`}
                  >
                    <Input placeholder='Значение' />
                  </TextField>
                </>
              )}

              {error && <ErrorMessage>{error}</ErrorMessage>}
            </div>
          );
        })}
      </div>

      <Popover.Root isOpen={isAddOpen} onOpenChange={setIsAddOpen}>
        <Popover.Trigger className='flex w-fit items-center gap-1 text-sm text-primary hover:underline'>
          <Plus size={16} />
          Добавить поле
        </Popover.Trigger>

        <Popover.Content>
          <Popover.Dialog>
            <CustomFieldNameTypeForm
              initialKey=''
              initialType='string'
              onSave={handleAdd}
              onClose={() => setIsAddOpen(false)}
            />
          </Popover.Dialog>
        </Popover.Content>
      </Popover.Root>

      {field.state.meta.errors.length > 0 && (
        <ErrorMessage>{field.state.meta.errors[0]?.message}</ErrorMessage>
      )}
    </div>
  );
}
