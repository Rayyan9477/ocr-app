import { Metadata } from 'next';
import SignInForm from '@/components/auth/sign-in-form';

export const metadata: Metadata = {
  title: 'Sign In | HIPAA Compliant OCR',
  description: 'Sign in to access the HIPAA compliant OCR system'
};

export default function SignInPage() {
  return (
    <div className="container flex h-screen w-screen flex-col items-center justify-center">
      <div className="mx-auto flex w-full flex-col justify-center space-y-6 sm:w-[350px]">
        <div className="flex flex-col space-y-2 text-center">
          <h1 className="text-2xl font-semibold tracking-tight">
            Welcome back
          </h1>
          <p className="text-sm text-muted-foreground">
            Sign in to access your HIPAA-compliant OCR workspace
          </p>
        </div>
        <SignInForm />
      </div>
    </div>
  );
}
