import { CircleAlert } from 'lucide-react';
import type { ReactNode } from 'react';

import { Button, Typography } from './index';

interface Props {
  children: ReactNode;
  onRetry?: () => void;
}

export function ErrorState({ children, onRetry }: Props) {
  return (
    <div className='flex flex-1 flex-col items-center justify-center gap-2 rounded-lg border border-dashed border-danger/40 py-10 text-center'>
      <CircleAlert size={32} className='text-danger' />
      <Typography type='body-sm' color='muted'>
        {children}
      </Typography>
      {onRetry && (
        <Button type='button' variant='ghost' size='sm' onPress={onRetry}>
          Повторить
        </Button>
      )}
    </div>
  );
}
