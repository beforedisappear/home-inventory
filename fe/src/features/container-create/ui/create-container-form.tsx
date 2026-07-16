import type { ReactNode } from 'react';

import { getContainerKindLabel } from '@/kernel/container/kind-label';

import type { components } from '@/kernel/api/schema';

import {
  Button,
  FormTextField,
  ListBox,
  Select,
  Spinner,
  Typography,
} from '@/shared/ui';

import { useCreateContainerForm } from '../model/use-create-container-form';

type ContainerRuleResponseDto =
  components['schemas']['ContainerRuleResponseDto'];

interface Props {
  parentId: string | null;
  onSuccess: () => void;
  onRequestClose: () => void;
  rules: ContainerRuleResponseDto[] | undefined;
  renderRuleField?: (props: {
    value: string;
    onChange: (ruleId: string) => void;
    onRequestClose: () => void;
  }) => ReactNode;
}

export function CreateContainerForm(props: Props) {
  const { parentId, onSuccess, onRequestClose, rules, renderRuleField } =
    props;

  const { form, allowedKinds } = useCreateContainerForm({
    parentId,
    onSuccess,
    rootRules: rules,
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
              onRequestClose,
            })
          }
        </form.Field>
      )}

      {parentId !== null && !isDeadEnd && (
        <form.Field name='kind'>
          {field => (
            <Select.Root
              value={field.state.value || null}
              onChange={key => field.handleChange(String(key))}
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
