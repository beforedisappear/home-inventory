import { LoginForm } from '@/features/auth';

export function LoginPage() {
  return (
    <div className='flex min-h-svh items-center justify-center p-4'>
      <div className='w-full max-w-sm'>
        <h1 className='mb-6 text-center text-2xl font-bold'>Вход</h1>
        <LoginForm />
      </div>
    </div>
  );
}
