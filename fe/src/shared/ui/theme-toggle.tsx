import { useTheme } from '@heroui/react';
import { Moon, Sun } from 'lucide-react';

export function ThemeToggle() {
  const { resolvedTheme, setTheme } = useTheme();
  const isDark = resolvedTheme === 'dark';

  return (
    <button
      type='button'
      onClick={() => setTheme(isDark ? 'light' : 'dark')}
      aria-label={isDark ? 'Светлая тема' : 'Тёмная тема'}
      className='flex size-9 items-center justify-center rounded-lg border border-border bg-surface text-foreground transition-colors hover:bg-surface-secondary'
    >
      {isDark ? <Sun size={18} /> : <Moon size={18} />}
    </button>
  );
}
