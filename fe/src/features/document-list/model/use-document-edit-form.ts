import { useForm } from '@tanstack/react-form';
import { useMutation } from '@tanstack/react-query';

import type { components } from '@/kernel/api/schema';

import { documentQueries } from '@/services/document';

import { toast } from '@/shared/ui';

import { documentEditSchema } from './schemas';

type DocumentResponseDto = components['schemas']['DocumentResponseDto'];

// date-input ждёт 'YYYY-MM-DD'; бек отдаёт полный ISO datetime
function toDateInputValue(iso: string | null): string {
  return iso ? iso.slice(0, 10) : '';
}

function toDefaultValues(doc: DocumentResponseDto) {
  return {
    type: doc.type,
    name: doc.name ?? '',
    description: doc.description ?? '',
    warrantyEndsAt: toDateInputValue(doc.warrantyEndsAt),
  };
}

interface UseDocumentEditFormProps {
  doc: DocumentResponseDto;
  onSaved: () => void;
}

export function useDocumentEditForm(props: UseDocumentEditFormProps) {
  const { doc, onSaved } = props;

  const { mutateAsync: updateDocument, isPending: isSaving } = useMutation(
    documentQueries.update(),
  );

  const form = useForm({
    defaultValues: toDefaultValues(doc),
    validators: { onSubmit: documentEditSchema },
    onSubmit: async ({ value }) => {
      try {
        await updateDocument({
          id: doc.id,
          itemId: doc.itemId,
          dto: {
            type: value.type,
            // пустая строка не шлётся — бек трактует undefined как "не менять",
            // явного "очистить поле" DTO не поддерживает (см. Global Constraints)
            name: value.name.trim() || undefined,
            description: value.description.trim() || undefined,
            warrantyEndsAt: value.warrantyEndsAt || undefined,
          },
        });
        onSaved();
      } catch {
        toast.danger('Не удалось сохранить документ');
      }
    },
  });

  // синхронизирует форму с актуальными данными карточки при каждом раскрытии
  // (пример: пользователь раскрыл, отменил правку, раскрыл снова)
  const resetToDoc = () => form.reset(toDefaultValues(doc));

  return { form, resetToDoc, isSaving };
}
