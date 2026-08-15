import { useQuery } from '@tanstack/react-query';

import { containerQueries } from '@/services/container';

import { Button, Spinner, Typography } from '@/shared/ui';

import { useReportGenerate } from '../model/use-report-generate';

interface Props {
  containerId: string;
}

export function ReportGenerateBanner(props: Props) {
  const { containerId } = props;

  const { data: container, isError } = useQuery(
    containerQueries.byId(containerId),
  );

  const { generate, isPending } = useReportGenerate(containerId);

  // контейнер с тех пор удалили (404) или другая ошибка загрузки — баннер
  // генерации не показываем, но список отчётов ниже работает независимо
  if (isError || !container) return null;

  return (
    <div className='flex items-center justify-between gap-3 rounded-lg border border-border p-3'>
      <Typography type='body-sm' weight='medium'>
        {container.name}
      </Typography>

      <Button
        type='button'
        size='sm'
        isDisabled={isPending}
        onPress={() => void generate()}
      >
        {isPending ? <Spinner size='sm' /> : 'Сформировать отчёт'}
      </Button>
    </div>
  );
}
