'use client';

import { useState } from 'react';
import { signIn } from 'next-auth/react';
import { useRouter } from 'next/navigation';

export default function SignInForm() {
  const router = useRouter();
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  async function onSubmit(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setIsLoading(true);
    setError('');

    const formData = new FormData(event.currentTarget);
    const email = formData.get('email') as string;
    const password = formData.get('password') as string;

    try {
      const result = await signIn('credentials', {
        email,
        password,
        redirect: false,
      });

      if (result?.error) {
        setError('Invalid credentials');
        setIsLoading(false);
        return;
      }

      router.push('/dashboard'); // Redirect to dashboard on success
    } catch (error) {
      setError('An error occurred. Please try again.');
      setIsLoading(false);
    }
  }

  return (
    <div className="grid gap-6">
      <form onSubmit={onSubmit}>
        <div className="grid gap-4">
          <div className="grid gap-2">
            <label htmlFor="email">Email</label>
            <input
              id="email"
              name="email"
              type="email"
              autoCapitalize="none"
              autoComplete="email"
              autoCorrect="off"
              disabled={isLoading}
              required
              className="w-full rounded-md border px-3 py-2"
            />
          </div>
          <div className="grid gap-2">
            <label htmlFor="password">Password</label>
            <input
              id="password"
              name="password"
              type="password"
              autoComplete="current-password"
              disabled={isLoading}
              required
              className="w-full rounded-md border px-3 py-2"
            />
          </div>
          {error && (
            <div className="text-red-500 text-sm">{error}</div>
          )}
          <button
            type="submit"
            disabled={isLoading}
            className={`w-full rounded-md bg-blue-600 px-3 py-2 text-white 
              ${isLoading ? 'opacity-50' : 'hover:bg-blue-700'}`}
          >
            {isLoading ? 'Signing in...' : 'Sign In'}
          </button>
        </div>
      </form>
      <div className="text-sm text-center text-gray-600">
        This is a HIPAA-compliant system. All actions are logged.
      </div>
    </div>
  );
}
