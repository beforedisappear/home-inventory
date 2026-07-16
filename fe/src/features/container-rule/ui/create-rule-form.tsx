import {
  CONTAINER_KINDS,
  getContainerKindLabel,
} from '@/kernel/container/kind-label';

import {
  Button,
  Checkbox,
  Drawer,
  FormTextField,
  Spinner,
  Typography,
} from '@/shared/ui';

import { useCreateRuleForm } from '../model/use-create-rule-form';

interface Props {
  onCreated: (ruleId: string) => void;
  onCancel: () => void;
}

// type="button" везде — Button/Checkbox рендерятся без обёртывающего <form>,
// сабмит идёт напрямую через form.handleSubmit()
export function CreateRuleForm({ onCreated, onCancel }: Props) {
  const { form } = useCreateRuleForm({ onCreated });

  return (
    <>
      <Drawer.Body className='flex flex-col gap-3'>
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
                      onChange={enabled =>
                        field.handleChange({ ...row, enabled })
                      }
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
                          {CONTAINER_KINDS.filter(
                            parent => parent !== kind,
                          ).map(parent => (
                            <Checkbox.Root
                              key={parent}
                              isSelected={row.allowedParents.includes(parent)}
                              onChange={isSelected =>
                                field.handleChange({
                                  ...row,
                                  allowedParents: isSelected
                                    ? [...row.allowedParents, parent]
                                    : row.allowedParents.filter(
                                        p => p !== parent,
                                      ),
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
                          ))}
                        </div>
                      </div>
                    )}
                  </div>
                );
              }}
            </form.Field>
          ))}
        </div>
      </Drawer.Body>

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
            <Drawer.Footer>
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
            </Drawer.Footer>
          );
        }}
      </form.Subscribe>
    </>
  );
}
