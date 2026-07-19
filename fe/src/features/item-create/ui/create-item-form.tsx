import { useQuery } from '@tanstack/react-query';

import { categoryQueries } from '@/services/category';

import {
  AdaptiveModal,
  Button,
  FormTextareaField,
  FormTextField,
  SelectField,
  Spinner,
} from '@/shared/ui';

import { useCreateItemForm } from '../model/use-create-item-form';

interface Props {
  containerId: string;
  onSuccess: () => void;
}

export function CreateItemForm(props: Props) {
  const { containerId, onSuccess } = props;

  const { form } = useCreateItemForm({ containerId, onSuccess });

  const { data: categories } = useQuery(categoryQueries.list());

  return (
    <form
      className='flex flex-1 flex-col'
      onSubmit={e => {
        e.preventDefault();
        e.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <AdaptiveModal.Body className='flex flex-col gap-4'>
        <form.Field name='name'>
          {field => <FormTextField field={field} label='Название' />}
        </form.Field>

        <form.Field name='categoryId'>
          {field => (
            <SelectField
              label='Категория'
              placeholder='Выберите категорию'
              value={field.state.value}
              onChange={field.handleChange}
              options={(categories ?? []).map(category => ({
                id: category.id,
                label: category.name,
              }))}
              noneOption={{ id: 'none', label: 'Без категории' }}
            />
          )}
        </form.Field>

        <form.Field name='quantity'>
          {field => (
            <FormTextField field={field} label='Количество' type='number' />
          )}
        </form.Field>

        <form.Field name='description'>
          {field => <FormTextareaField field={field} label='Описание' />}
        </form.Field>
      </AdaptiveModal.Body>

      <AdaptiveModal.Footer>
        <form.Subscribe
          selector={s => ({
            canSubmit: s.canSubmit,
            isSubmitting: s.isSubmitting,
          })}
        >
          {({ canSubmit, isSubmitting }) => (
            <Button type='submit' isDisabled={!canSubmit || isSubmitting}>
              {isSubmitting ? <Spinner /> : 'Добавить'}
            </Button>
          )}
        </form.Subscribe>
      </AdaptiveModal.Footer>
    </form>
  );
}
