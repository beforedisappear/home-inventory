import { useForm } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';

import { containerQueries } from '@/services/container';

import { toast } from '@/shared/ui';

import { containerEditSchema } from './schemas';

interface UseContainerEditFormProps {
  containerId: string;
  parentId: string | null;
  name: string;
  onSuccess: () => void;
}

export function useContainerEditForm(props: UseContainerEditFormProps) {
  const { containerId, parentId, name, onSuccess } = props;

  const { mutateAsync: updateContainer } = useMutation(
    containerQueries.update(),
  );

  const form = useForm({
    defaultValues: { name },
    validators: { onSubmit: containerEditSchema },
    onSubmit: async ({ value }) => {
      try {
        await updateContainer({
          id: containerId,
          parentId,
          name: value.name,
        });
        toast.success('Контейнер обновлён');
        onSuccess();
      } catch {
        toast.danger('Не удалось сохранить изменения');
      }
    },
  });

  return { form };
}
