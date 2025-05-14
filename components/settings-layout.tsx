import React from "react";
import { Card, CardContent } from "@/components/ui/card";
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { HelpCircle } from "lucide-react";
import { cn } from "@/lib/utils";

interface SettingsLayoutProps {
  children: React.ReactNode;
  title: string;
  description?: string;
  icon?: React.ReactNode;
  tooltip?: string;
  className?: string;
}

export function SettingsLayout({
  children,
  title,
  description,
  icon,
  tooltip,
  className,
}: SettingsLayoutProps) {
  return (
    <Card className={cn("transition-all duration-200", className)}>
      <CardContent className="p-4">
        <div className="flex flex-col space-y-1.5 mb-3">
          <div className="flex items-center gap-2">
            {icon && <div className="flex-shrink-0 text-muted-foreground">{icon}</div>}
            <div className="font-semibold text-sm flex items-center gap-1.5">
              {title}
              {tooltip && (
                <TooltipProvider>
                  <Tooltip>
                    <TooltipTrigger asChild>
                      <HelpCircle className="h-3.5 w-3.5 text-muted-foreground/70 cursor-help" />
                    </TooltipTrigger>
                    <TooltipContent className="max-w-xs">
                      <p className="text-xs">{tooltip}</p>
                    </TooltipContent>
                  </Tooltip>
                </TooltipProvider>
              )}
            </div>
          </div>
          {description && <p className="text-xs text-muted-foreground">{description}</p>}
        </div>
        {children}
      </CardContent>
    </Card>
  );
}
