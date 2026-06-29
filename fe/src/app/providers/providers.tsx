import type { ReactNode } from 'react';

import { QueryProvider } from './query-provider';
import { ToastProvider } from './toast-provider';

interface Props {
  children: ReactNode;
}

export function Providers(props: Props) {
  const { children } = props;

  return (
    <QueryProvider>
      <ToastProvider>{children}</ToastProvider>
    </QueryProvider>
  );
}
