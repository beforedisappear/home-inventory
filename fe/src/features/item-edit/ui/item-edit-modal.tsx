import type { UseOverlayStateReturn } from '@/shared/ui';
import { AdaptiveModal } from '@/shared/ui';

interface Props {
  children: React.ReactNode;
  state: UseOverlayStateReturn;
}

export function ItemEditModal(props: Props) {
  const { children, state } = props;

  return (
    <AdaptiveModal state={state} heading='Редактирование вещи'>
      {children}
    </AdaptiveModal>
  );
}
