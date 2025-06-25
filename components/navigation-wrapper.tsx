'use client';

import { usePathname } from 'next/navigation';
import { Suspense } from 'react';

export default function NavigationWrapper() {
  const pathname = usePathname();
  
  return (
    <Suspense fallback={<div>Loading...</div>}>
      <nav className="bg-background border-b">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between h-16">
            <div className="flex">
              <div className="flex-shrink-0 flex items-center">
                <img className="h-8 w-auto" src="/ocr-logo.svg" alt="OCR App" />
              </div>
            </div>
          </div>
        </div>
      </nav>
    </Suspense>
  );
}
