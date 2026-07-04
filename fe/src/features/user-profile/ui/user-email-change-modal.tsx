import { Button, Modal, type UseOverlayStateReturn } from '@/shared/ui';

interface Props {
  children: React.ReactNode;
  state: UseOverlayStateReturn;
}

export function UserEmailChangeModal(props: Props) {
  const { children, state } = props;

  return (
    <Modal.Root state={state}>
      <Modal.Trigger>
        <Button type='button' variant='ghost' size='sm'>
          Изменить email
        </Button>
      </Modal.Trigger>

      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className='h-52'>
            <Modal.Header>
              <Modal.Heading>Смена email</Modal.Heading>
              <Modal.CloseTrigger />
            </Modal.Header>

            {children}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal.Root>
  );
}
