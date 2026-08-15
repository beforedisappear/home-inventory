import { useEffect, useState } from 'react';

import { useQuery, useQueryClient } from '@tanstack/react-query';
import { FileStack } from 'lucide-react';

import { onReportEvent, reportQueries } from '@/services/report';

import { EmptyState, ErrorState, Skeleton } from '@/shared/ui';

import { ReportCard } from './report-card';
import { ReportDeleteDialog } from './report-delete-dialog';

interface Props {
  containerId?: string;
}

export function ReportList(props: Props) {
  const { containerId } = props;

  const [deleteTargetId, setDeleteTargetId] = useState<string | null>(null);

  const queryClient = useQueryClient();

  const {
    data: reports,
    isPending,
    isError,
    refetch,
  } = useQuery(reportQueries.list());

  // живое обновление: любое SSE-событие инвалидирует список, независимо от
  // активного клиентского фильтра по контейнеру
  useEffect(() => {
    const listener = onReportEvent(() => {
      void queryClient.invalidateQueries({ queryKey: reportQueries.listKey });
    });

    return () => {
      listener();
    };
  }, [queryClient]);

  const content = (() => {
    if (isPending) {
      return (
        <div className='flex flex-col gap-2'>
          <Skeleton className='h-16 w-full rounded-lg' />
          <Skeleton className='h-16 w-full rounded-lg' />
        </div>
      );
    }

    if (isError) {
      return (
        <ErrorState onRetry={() => refetch()}>
          Не удалось загрузить отчёты
        </ErrorState>
      );
    }

    const filtered = containerId
      ? reports.filter(r => r.containerId === containerId)
      : reports;

    const sorted = [...filtered].sort(
      (a, b) =>
        new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
    );

    if (sorted.length === 0) {
      return <EmptyState icon={FileStack}>Отчётов пока нет</EmptyState>;
    }

    return (
      <div className='flex flex-col gap-2'>
        {sorted.map(report => (
          <ReportCard
            key={report.id}
            report={report}
            onDelete={setDeleteTargetId}
          />
        ))}
      </div>
    );
  })();

  return (
    <>
      {content}
      <ReportDeleteDialog
        reportId={deleteTargetId}
        onClose={() => setDeleteTargetId(null)}
      />
    </>
  );
}
