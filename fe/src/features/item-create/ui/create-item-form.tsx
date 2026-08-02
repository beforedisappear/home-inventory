import { useRef } from 'react';
import type { ReactNode } from 'react';

import { useIsMutating, useQuery } from '@tanstack/react-query';

import { categoryQueries } from '@/services/category';
import {
  CustomFieldsField,
  ItemPhotosField,
  itemQueries,
  type ItemPhotosFieldHandle,
} from '@/services/item';
import { RecognitionPhotoField } from '@/services/recognition';

import {
  Button,
  Drawer,
  FormTextareaField,
  FormTextField,
  SelectField,
  Spinner,
} from '@/shared/ui';

import { useCreateItemForm } from '../model/use-create-item-form';
import { useRecognitionDraftMerge } from '../model/use-recognition-draft-merge';
import { RecognitionDraftConfirmModal } from './recognition-draft-confirm-modal';

interface Props {
  containerId: string;
  onSuccess: () => void;
  categorySlot?: ReactNode;
}

export function CreateItemForm(props: Props) {
  const { containerId, onSuccess, categorySlot } = props;

  const { form } = useCreateItemForm({ containerId, onSuccess });

  const { data: categories } = useQuery(categoryQueries.list());
  const uploadingCount = useIsMutating({
    mutationKey: itemQueries.uploadPhotoKey(),
  });

  const photosFieldRef = useRef<ItemPhotosFieldHandle>(null);

  const { conflicts, handleDraftReady, handleResolve } =
    useRecognitionDraftMerge(form, categories);

  return (
    <form
      className='flex min-h-0 flex-1 flex-col'
      onSubmit={e => {
        e.preventDefault();
        e.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <Drawer.Body className='flex flex-col gap-4'>
        <RecognitionPhotoField
          onDraftReady={(draft, file) => {
            photosFieldRef.current?.addFiles([file]);
            handleDraftReady(draft);
          }}
        />

        <form.Field name='name'>
          {field => <FormTextField field={field} label='Название' />}
        </form.Field>

        <form.Field name='categoryId'>
          {field => (
            <div className='flex items-end gap-2'>
              <SelectField
                className='flex-1'
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
              {categorySlot}
            </div>
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

        <form.Field name='photos'>
          {field => (
            <ItemPhotosField
              ref={photosFieldRef}
              field={field}
              initialPhotos={[]}
            />
          )}
        </form.Field>

        <form.Field name='customFields'>
          {field => <CustomFieldsField field={field} />}
        </form.Field>
      </Drawer.Body>

      <Drawer.Footer>
        <form.Subscribe
          selector={s => ({
            canSubmit: s.canSubmit,
            isSubmitting: s.isSubmitting,
          })}
        >
          {({ canSubmit, isSubmitting }) => (
            <Button
              type='submit'
              isDisabled={!canSubmit || isSubmitting || uploadingCount > 0}
            >
              {isSubmitting ? <Spinner /> : 'Добавить'}
            </Button>
          )}
        </form.Subscribe>
      </Drawer.Footer>

      {conflicts && (
        <RecognitionDraftConfirmModal
          conflicts={conflicts}
          onConfirm={handleResolve}
        />
      )}
    </form>
  );
}
