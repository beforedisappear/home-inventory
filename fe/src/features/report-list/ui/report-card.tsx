import { useQuery } from '@tanstack/react-query';
import { Download, Trash2 } from 'lucide-react';

import { containerQueries } from '@/services/container';

import type { components } from '@/kernel/api/schema';

import { Chip, Spinner, Typography } from '@/shared/ui';

import { useReportDownload } from '../model/use-report-download';

type ReportResponseDto = components['schemas']['ReportResponseDto'];

const STATUS_LABELS: Record<ReportResponseDto['status'], string> = {
  pending: 'Ожидание',
  processing: 'Формируется',
  ready: 'Готово',
  failed: 'Ошибка',
};

// HeroUI Chip's color union is 'default'|'accent'|'success'|'warning'|'danger'
// (see @heroui/styles chip.styles.d.ts) — no 'primary', hence 'accent' here.
const STATUS_COLORS: Record<
  ReportResponseDto['status'],
  'default' | 'accent' | 'success' | 'danger'
> = {
  pending: 'default',
  processing: 'accent',
  ready: 'success',
  failed: 'danger',
};

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.round(bytes / 1024)} КБ`;

  return `${(bytes / (1024 * 1024)).toFixed(1)} МБ`;
}

interface Props {
  report: ReportResponseDto;
  onDelete: (reportId: string) => void;
}

export function ReportCard(props: Props) {
  const { report, onDelete } = props;

  const { data: container, isError: isContainerError } = useQuery(
    containerQueries.byId(report.containerId),
  );

  const { download, isDownloading } = useReportDownload(
    report.id,
    report.containerId,
  );

  // 404 (контейнер с тех пор удалили) и любая другая ошибка загрузки контейнера
  // трактуются одинаково — карточка отчёта не должна ломаться из-за этого
  const containerName = isContainerError
    ? 'Контейнер удалён'
    : (container?.name ?? '…');

  return (
    <div className='flex items-center gap-3 rounded-lg border border-border p-3'>
      <div className='flex flex-1 flex-col items-start gap-1'>
        <div className='flex items-center gap-2'>
          <Typography type='body-sm' weight='medium'>
            {containerName}
          </Typography>
          <Chip size='sm' color={STATUS_COLORS[report.status]}>
            {STATUS_LABELS[report.status]}
          </Chip>
        </div>

        <Typography type='body-xs' color='muted'>
          {new Date(report.createdAt).toLocaleDateString('ru-RU')}
          {report.itemCount !== null && ` · ${report.itemCount} вещей`}
          {report.fileSize !== null && ` · ${formatFileSize(report.fileSize)}`}
        </Typography>
      </div>

      {report.status === 'ready' && (
        <button
          type='button'
          aria-label='Скачать отчёт'
          disabled={isDownloading}
          onClick={() => void download()}
          className='flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-secondary hover:text-primary disabled:pointer-events-none'
        >
          {isDownloading ? <Spinner size='sm' /> : <Download size={16} />}
        </button>
      )}

      <button
        type='button'
        aria-label='Удалить отчёт'
        onClick={() => onDelete(report.id)}
        className='flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-secondary hover:text-danger'
      >
        <Trash2 size={16} />
      </button>
    </div>
  );
}
