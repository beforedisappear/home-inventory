import { useNavigate } from '@tanstack/react-router';
import { Menu as MenuIcon } from 'lucide-react';

import { ROUTES } from '@/kernel/routes';

import { Dropdown } from '@/shared/ui';

interface Props {
  isLoggingOut: boolean;
  onLogout: () => void;
}

export function HeaderMobileContent(props: Props) {
  const navigate = useNavigate();

  const actions = [
    {
      id: 'profile',
      label: 'Профиль',
      onAction: () => void navigate({ to: ROUTES.PROFILE }),
    },
    {
      id: 'logout',
      label: 'Выйти',
      onAction: props.onLogout,
      isDisabled: props.isLoggingOut,
    },
  ];

  return (
    <div className='sm:hidden'>
      <Dropdown.Root>
        <Dropdown.Trigger>
          <button
            type='button'
            aria-label='Меню'
            className='flex size-9 items-center justify-center rounded-lg border border-border bg-surface text-foreground transition-colors hover:bg-surface-secondary'
          >
            <MenuIcon size={18} />
          </button>
        </Dropdown.Trigger>

        <Dropdown.Popover>
          <Dropdown.Menu>
            {actions.map(action => (
              <Dropdown.Item
                key={action.id}
                id={action.id}
                onAction={action.onAction}
                isDisabled={action.isDisabled}
              >
                {action.label}
              </Dropdown.Item>
            ))}
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown.Root>
    </div>
  );
}
