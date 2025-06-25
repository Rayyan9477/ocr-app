'use client';

import { useEffect } from 'react';

export default function ClientWrapper({ children }: { children: React.ReactNode }) {
  useEffect(() => {
    // Client-side initialization code can go here
  }, []);

  return <>{children}</>;
}
