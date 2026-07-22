import type { UseOverlayStateReturn } from '@/shared/ui';
import { AdaptiveDrawer } from '@/shared/ui';

interface Props {
  children: React.ReactNode;
  state: UseOverlayStateReturn;
}

export function CreateItemDrawer(props: Props) {
  const { children, state } = props;

  return (
    <AdaptiveDrawer
      state={state}
      heading='Новая вещь'
      dialogClassName='sm:w-2/5'
    >
      {children}
    </AdaptiveDrawer>
  );
}
