"use client"

import React from 'react';
import MainNavigation from './main-navigation';
import ExtractablePdfFloatingButton from './extractable-pdf-floating-button';

export function NavigationWrapper() {
  return (
    <>
      <MainNavigation />
      <ExtractablePdfFloatingButton />
    </>
  );
}

export default NavigationWrapper;
