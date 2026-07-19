import { useQuery } from '@tanstack/react-query';

import { categoryQueries } from '@/services/category';

import type { components } from '@/kernel/api/schema';

import {
  Button,
  FormTextareaField,
  FormTextField,
  SelectField,
  Spinner,
} from '@/shared/ui';

import { useItemEditForm } from '../model/use-item-edit-form';

type ItemResponseDto = components['schemas']['ItemResponseDto'];

interface Props {
  item: ItemResponseDto;
  containerId: string;
}

export function ItemEditForm({ item, containerId }: Props) {
  const { form } = useItemEditForm({ item, containerId });

  const { data: categories } = useQuery(categoryQueries.list());

  return (
    <form
      className='flex flex-col gap-4'
      onSubmit={e => {
        e.preventDefault();
        e.stopPropagation();
        void form.handleSubmit();
      }}
    >
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

      <form.Subscribe
        selector={s => ({
          canSubmit: s.canSubmit,
          isSubmitting: s.isSubmitting,
        })}
      >
        {({ canSubmit, isSubmitting }) => (
          <Button
            type='submit'
            isDisabled={!canSubmit || isSubmitting}
            className='self-start'
          >
            {isSubmitting ? <Spinner /> : 'Сохранить'}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
