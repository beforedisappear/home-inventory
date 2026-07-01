import { LoginForm } from '@/features/auth';

import { ThemeToggle } from '@/shared/ui';

export function LoginPage() {
  return (
    <div className='relative flex min-h-svh items-center justify-center p-4'>
      <div className='absolute right-4 top-4'>
        <ThemeToggle />
      </div>
      <LoginForm />
    </div>
  );
}
