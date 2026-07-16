import type { ReactNode } from 'react';

import { Drawer, Modal, type UseOverlayStateReturn } from '@heroui/react';

import { useDeviceType } from '@/shared/lib/device-type';

interface AdaptiveModalProps {
  state: UseOverlayStateReturn;
  heading: string;
  children: ReactNode;
  className?: string;
}

// адаптивная модалка: на десктопе — обычная модалка по центру,
// на мобилке — bottom-дровер с ручкой. контент внутри использует
// AdaptiveModal.Body / AdaptiveModal.Footer — они переключаются вместе с обёрткой
export function AdaptiveModal(props: AdaptiveModalProps) {
  const { state, heading, children, className } = props;
  const { isMobile } = useDeviceType();

  if (isMobile) {
    return (
      <Drawer.Root state={state}>
        <Drawer.Backdrop>
          <Drawer.Content placement='bottom'>
            <Drawer.Dialog className={className}>
              <Drawer.Handle />
              <Drawer.Header>
                <Drawer.Heading>{heading}</Drawer.Heading>
                <Drawer.CloseTrigger />
              </Drawer.Header>

              {children}
            </Drawer.Dialog>
          </Drawer.Content>
        </Drawer.Backdrop>
      </Drawer.Root>
    );
  }

  return (
    <Modal.Root state={state}>
      <Modal.Backdrop>
        <Modal.Container>
          <Modal.Dialog className={className}>
            <Modal.Header>
              <Modal.Heading>{heading}</Modal.Heading>
              <Modal.CloseTrigger />
            </Modal.Header>

            {children}
          </Modal.Dialog>
        </Modal.Container>
      </Modal.Backdrop>
    </Modal.Root>
  );
}

interface SectionProps {
  children?: ReactNode;
  className?: string;
}

function AdaptiveModalBody({ children, className }: SectionProps) {
  const { isMobile } = useDeviceType();
  const Body = isMobile ? Drawer.Body : Modal.Body;

  return <Body className={className}>{children}</Body>;
}

function AdaptiveModalFooter({ children, className }: SectionProps) {
  const { isMobile } = useDeviceType();
  const Footer = isMobile ? Drawer.Footer : Modal.Footer;

  return <Footer className={className}>{children}</Footer>;
}

AdaptiveModal.Body = AdaptiveModalBody;
AdaptiveModal.Footer = AdaptiveModalFooter;
