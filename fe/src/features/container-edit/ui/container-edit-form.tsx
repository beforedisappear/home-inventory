import { AdaptiveModal, Button, FormTextField, Spinner } from '@/shared/ui';

import { useContainerEditForm } from '../model/use-container-edit-form';

interface Props {
  containerId: string;
  parentId: string | null;
  name: string;
  onSuccess: () => void;
}

export function ContainerEditForm(props: Props) {
  const { form } = useContainerEditForm(props);

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
              {isSubmitting ? <Spinner /> : 'Сохранить'}
            </Button>
          )}
        </form.Subscribe>
      </AdaptiveModal.Footer>
    </form>
  );
}
