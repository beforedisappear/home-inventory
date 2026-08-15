import { Link, useSearch } from '@tanstack/react-router';

import { ReportGenerateBanner } from '@/features/report-generate';
import { ReportList } from '@/features/report-list';

import { ROUTES } from '@/kernel/routes';

import { Typography } from '@/shared/ui';

export function ReportsPage() {
  const { containerId } = useSearch({ from: '/protected/reports' });

  return (
    <div className='flex flex-1 flex-col items-center p-4'>
      <div className='flex w-full max-w-2xl flex-col gap-4'>
        <Typography type='h3'>Мои отчёты</Typography>

        {containerId && (
          <>
            <ReportGenerateBanner containerId={containerId} />
            <Link to={ROUTES.REPORTS} search={{}} className='self-start'>
              <Typography type='body-sm' color='muted'>
                Показать все отчёты
              </Typography>
            </Link>
          </>
        )}

        <ReportList containerId={containerId} />
      </div>
    </div>
  );
}
