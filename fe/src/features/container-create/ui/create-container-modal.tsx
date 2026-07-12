import type { UseOverlayStateReturn } from '@/shared/ui';
import { Modal } from '@/shared/ui';

interface Props {
  children: React.ReactNode;
  state: UseOverlayStateReturn;
}

export function CreateContainerModal(props: Props) {
  const { state, children } = props;

  return (
    <Modal.Root state={state}>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className='min-h-57.5'>
            <Modal.Header>
              <Modal.Heading>Новый контейнер</Modal.Heading>
              <Modal.CloseTrigger />
            </Modal.Header>

            {children}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal.Root>
  );
}
