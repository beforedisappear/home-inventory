import type { UseOverlayStateReturn } from '@/shared/ui';
import { AdaptiveModal } from '@/shared/ui';

interface Props {
  children: React.ReactNode;
  state: UseOverlayStateReturn;
}

export function CreateContainerModal(props: Props) {
  const { state, children } = props;

  return (
    <AdaptiveModal
      state={state}
      heading='Новый контейнер'
      className='min-h-57.5'
    >
      {children}
    </AdaptiveModal>
  );
}
