"use client"

import { useEffect, useLayoutEffect } from 'react'

/**
 * A safe version of useLayoutEffect that falls back to useEffect during SSR
 * This hook is used to prevent the "useLayoutEffect does nothing on the server" warning
 * 
 * Use this hook instead of useLayoutEffect for components that might be rendered during SSR
 */
export const useIsomorphicLayoutEffect =
  typeof window !== 'undefined' &&
  typeof window.document !== 'undefined' &&
  typeof window.document.createElement !== 'undefined'
    ? useLayoutEffect
    : useEffect
