import type { ReactNode } from 'react';

import { Drawer, type UseOverlayStateReturn } from '@heroui/react';

import { useDeviceType } from '@/shared/lib/device-type';

interface Props {
  state: UseOverlayStateReturn;
  heading: string;
  children: ReactNode;
  dialogClassName?: string;
}

// адаптивный дровер: на десктопе выезжает справа, на мобилке — слева.
// контент внутри использует Drawer.Body / Drawer.Footer
export function AdaptiveDrawer(props: Props) {
  const { state, heading, children, dialogClassName } = props;

  const { isMobile } = useDeviceType();

  return (
    <Drawer.Root state={state}>
      <Drawer.Backdrop>
        <Drawer.Content placement={isMobile ? 'left' : 'right'}>
          <Drawer.Dialog className={dialogClassName}>
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
