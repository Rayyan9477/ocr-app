import { Metadata } from 'next';
import Link from 'next/link';

export const metadata: Metadata = {
  title: 'Authentication Error',
  description: 'An error occurred during authentication',
};

export default function AuthErrorPage() {
  return (
    <div className="container flex h-screen w-screen flex-col items-center justify-center">
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
        <div className="flex flex-col space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight text-red-600">
            Authentication Error
          </h1>
          <p className="text-sm text-muted-foreground">
            An error occurred during the authentication process. This may be due to:
          </p>
          <ul className="text-sm text-gray-600 list-disc list-inside mt-2">
            <li>Invalid credentials</li>
            <li>Account lockout due to too many attempts</li>
            <li>Session timeout</li>
            <li>System maintenance</li>
          </ul>
        </div>
        <Link 
          href="/auth/signin"
          className="w-full rounded-md bg-blue-600 px-3 py-2 text-white text-center hover:bg-blue-700"
        >
          Return to Sign In
        </Link>
      </div>
    </div>
  );
}
