import { Link } from '@tanstack/react-router';
import { FileBarChart } from 'lucide-react';

import { ROUTES } from '@/kernel/routes';

interface Props {
  containerId: string;
}

export function ReportsLink(props: Props) {
  const { containerId } = props;

  return (
    <Link
      to={ROUTES.REPORTS}
      search={{ containerId }}
      aria-label='Отчёты по контейнеру'
      className='flex size-8 shrink-0 items-center justify-center rounded-lg text-muted transition-colors hover:bg-surface-secondary hover:text-primary'
    >
      <FileBarChart size={16} />
    </Link>
  );
}
