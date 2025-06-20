"use client"

import React from 'react';
import Link from 'next/link';
import { Button } from '@/components/ui/button';
import { FileText, ArrowRight } from 'lucide-react';
import {
  Card,
  CardContent,
  CardDescription,
  CardFooter,
  CardHeader,
  CardTitle,
} from '@/components/ui/card';

export function ExtractablePdfQuickAccess() {
  return (
    <Card className="border-dashed">
      <CardHeader className="gap-2">
        <CardTitle className="flex items-center gap-2">
          <FileText className="h-5 w-5 text-primary" />
          Extractable PDF
        </CardTitle>
        <CardDescription>
          Process PDFs to make them extractable while preserving visual appearance
        </CardDescription>
      </CardHeader>
      <CardContent>
        <p className="text-sm text-muted-foreground">
          This feature allows you to create searchable PDFs with extractable text,
          while maintaining the exact same visual appearance as the original document.
        </p>
      </CardContent>
      <CardFooter>
        <Button asChild>
          <Link href="/extractable-pdf" className="flex items-center gap-2">
            Try It Now
            <ArrowRight className="h-4 w-4" />
          </Link>
        </Button>
      </CardFooter>
    </Card>
  );
}

export default ExtractablePdfQuickAccess;
