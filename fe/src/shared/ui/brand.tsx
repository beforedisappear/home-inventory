import { Package } from 'lucide-react';

import { Typography } from './index';

interface Props {
  title: string;
}

export function Brand({ title }: Props) {
  return (
    <div className='flex items-center gap-2'>
      <span className='flex size-8 items-center justify-center rounded-lg bg-accent text-accent-foreground'>
        <Package size={18} />
      </span>
      <Typography weight='semibold'>{title}</Typography>
    </div>
  );
}
