'use client';

import * as React from 'react';
import { useIsomorphicLayoutEffect } from '@/lib/client-utilities';

interface ShadowPortalProps {
  children: React.ReactNode;
}

export function ShadowPortal({ children }: ShadowPortalProps) {
  const [portalContainer, setPortalContainer] = React.useState<HTMLDivElement | null>(null);
  const [shadowRoot, setShadowRoot] = React.useState<ShadowRoot | null>(null);

  useIsomorphicLayoutEffect(() => {
    if (!portalContainer) {
      const container = document.createElement('div');
      document.body.appendChild(container);
      setPortalContainer(container);
      
      const root = container.attachShadow({ mode: 'open' });
      setShadowRoot(root);

      return () => {
        document.body.removeChild(container);
      };
    }
  }, [portalContainer]);

  if (!shadowRoot) {
    return null;
  }

  return React.createElement(React.Fragment, null, children);
}

export default ShadowPortal;
