import type { ReactNode } from 'react';

import { Toast } from '@/shared/ui';

interface Props {
  children: ReactNode;
}

export function ToastProvider(props: Props) {
  const { children } = props;

  return <Toast.Provider placement="top">{children}</Toast.Provider>;
}
