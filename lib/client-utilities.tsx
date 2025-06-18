/**
 * Client component utilities for handling React effects properly in Next.js
 */

'use client';

import { useEffect, useLayoutEffect, useState, ReactNode } from 'react';

// Use useLayoutEffect on client, useEffect on server
export const useIsomorphicLayoutEffect = 
  typeof window !== 'undefined' ? useLayoutEffect : useEffect;

// Empty component to force client-side rendering
export function ClientOnly({ children }: { children: ReactNode }) {
  const [isClient, setIsClient] = useState(false);
  
  useEffect(() => {
    setIsClient(true);
  }, []);
  
  return isClient ? children : null;
}
