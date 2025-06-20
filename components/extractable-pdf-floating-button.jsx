"use client";

import React from 'react';
import Link from 'next/link';
import { FileText } from 'lucide-react';
import { Button } from '@/components/ui/button';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from '@/components/ui/tooltip';

export function ExtractablePdfFloatingButton() {
  return (
    <div className="fixed bottom-4 right-4 z-50">
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <Button
              size="lg"
              className="rounded-full w-14 h-14 shadow-lg"
              asChild
            >
              <Link href="/extractable-pdf">
                <FileText className="h-6 w-6" />
                <span className="sr-only">Make PDF Extractable</span>
              </Link>
            </Button>
          </TooltipTrigger>
          <TooltipContent side="left">
            <p>Make PDF Extractable</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
    </div>
  );
}

export default ExtractablePdfFloatingButton;
