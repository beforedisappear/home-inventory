import { Button, FormTextField, Spinner } from '@/shared/ui';

import { useUserProfileForm } from '../model/use-user-profile-form';

interface Props {
  name: string;
}

export function UserProfileForm(props: Props) {
  const { form } = useUserProfileForm({ name: props.name });

  return (
    <form
      className='flex flex-col gap-3 flex-1'
      onSubmit={e => {
        e.preventDefault();
        e.stopPropagation();
        void form.handleSubmit();
      }}
    >
      <form.Field name='name'>
        {field => <FormTextField field={field} label='Имя' />}
      </form.Field>

      <form.Subscribe
        selector={state => ({
          canSubmit: state.canSubmit,
          isSubmitting: state.isSubmitting,
        })}
      >
        {({ canSubmit, isSubmitting }) => (
          <Button
            type='submit'
            className='w-full mt-auto'
            isDisabled={!canSubmit || isSubmitting}
          >
            {isSubmitting ? <Spinner /> : 'Сохранить'}
          </Button>
        )}
      </form.Subscribe>
    </form>
  );
}
