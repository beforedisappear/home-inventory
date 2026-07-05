import type { LucideIcon } from 'lucide-react';
import type { ReactNode } from 'react';

import { Typography } from './index';

interface Props {
  icon: LucideIcon;
  children: ReactNode;
}

export function EmptyState({ icon: Icon, children }: Props) {
  return (
    <div className='flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-border-tertiary py-10 text-center'>
      <Icon size={32} className='text-muted' />
      <Typography type='body-sm' color='muted'>
        {children}
      </Typography>
    </div>
  );
}
