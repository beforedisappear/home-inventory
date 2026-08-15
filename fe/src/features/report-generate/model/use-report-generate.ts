import { useMutation } from '@tanstack/react-query';

import { reportQueries } from '@/services/report';

import { isStatusCode } from '@/shared/lib/api-error';
import { toast } from '@/shared/ui';

export function useReportGenerate(containerId: string) {
  const { mutateAsync: createReport, isPending } = useMutation(
    reportQueries.create(),
  );

  const generate = async () => {
    try {
      await createReport(containerId);
    } catch (err) {
      if (isStatusCode(err, 409)) {
        toast.danger('Уже есть активный отчёт — дождитесь его завершения');
        return;
      }

      if (isStatusCode(err, 400)) {
        toast.danger('Слишком много вещей в контейнере для отчёта');
        return;
      }

      toast.danger('Не удалось запустить формирование отчёта');
    }
  };

  return { generate, isPending };
}
