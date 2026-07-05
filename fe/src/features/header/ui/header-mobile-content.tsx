import { useNavigate } from '@tanstack/react-router';
import { Menu as MenuIcon } from 'lucide-react';

import { ROUTES } from '@/kernel/routes';

import { Dropdown } from '@/shared/ui';

type MenuAction = 'profile' | 'logout';

interface Props {
  isLoggingOut: boolean;
  onLogout: () => void;
}

// сюда добавляются остальные кнопки хедера на мобильных экранах
export function HeaderMobileContent(props: Props) {
  const navigate = useNavigate();

  const actioByKey: Record<MenuAction, () => void> = {
    profile: () => void navigate({ to: ROUTES.PROFILE }),
    logout: () => props.onLogout(),
  };

  const handleAction = (key: MenuAction) => {
    const action = actioByKey[key];

    if (!action) return;

    action();
  };

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
          <Dropdown.Menu onAction={key => handleAction(key as MenuAction)}>
            <Dropdown.Item id='profile'>Профиль</Dropdown.Item>
            <Dropdown.Item id='logout' isDisabled={props.isLoggingOut}>
              Выйти
            </Dropdown.Item>
          </Dropdown.Menu>
        </Dropdown.Popover>
      </Dropdown.Root>
    </div>
  );
}
