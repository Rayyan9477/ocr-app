import React from "react";
import Image from "next/image";
import { cva, type VariantProps } from "class-variance-authority";
import { cn } from "@/lib/utils";
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from "lucide-react";

const notificationVariants = cva(
  "fixed flex items-start gap-4 p-4 rounded-lg shadow-lg transition-all duration-300 z-50",
  {
    variants: {
      position: {
        topRight: "top-4 right-4",
        topLeft: "top-4 left-4",
        bottomRight: "bottom-4 right-4",
        bottomLeft: "bottom-4 left-4",
        center: "top-1/2 left-1/2 transform -translate-x-1/2 -translate-y-1/2",
      },
      variant: {
        default: "bg-background text-foreground border border-border",
        success: "bg-green-50 text-green-900 border border-green-200",
        error: "bg-red-50 text-red-900 border border-red-200",
        warning: "bg-yellow-100 text-yellow-950 border border-yellow-200",
        info: "bg-blue-50 text-blue-900 border border-blue-200",
      },
      size: {
        default: "max-w-sm",
        sm: "max-w-xs",
        lg: "max-w-md",
      },
    },
    defaultVariants: {
      position: "topRight",
      variant: "default",
      size: "default",
    },
  }
);

interface BrandedNotificationProps
  extends React.HTMLAttributes<HTMLDivElement>,
    VariantProps<typeof notificationVariants> {
  title: string;
  description?: string;
  icon?: React.ReactNode;
  showLogo?: boolean;
  showCloseButton?: boolean;
  onClose?: () => void;
}

export function BrandedNotification({
  title,
  description,
  icon,
  showLogo = true,
  showCloseButton = true,
  onClose,
  position,
  variant = "default",
  size,
  className,
  ...props
}: BrandedNotificationProps) {
  // Auto-select icon based on variant if not provided
  const autoIcon = React.useMemo(() => {
    if (icon) return icon;
    
    switch (variant) {
      case "success":
        return <CheckCircle className="h-5 w-5 text-green-600" />;
      case "error":
        return <AlertCircle className="h-5 w-5 text-red-600" />;
      case "warning":
        return <AlertTriangle className="h-5 w-5 text-yellow-600" />;
      case "info":
        return <Info className="h-5 w-5 text-blue-600" />;
      default:
        return null;
    }
  }, [icon, variant]);

  return (
    <div
      className={cn(
        notificationVariants({ position, variant, size }), 
        "animate-in fade-in slide-in-from-right-10 duration-300",
        className
      )}
      {...props}
    >
      {showLogo && (
        <div className="flex-shrink-0 w-10 h-10 relative animate-pulse-glow">
          <div className="absolute inset-0 rounded-full bg-white shadow-sm"></div>
          <Image
            src="/ocr-logo-small.svg"
            alt="OCR App"
            fill
            className="object-contain p-1"
          />
        </div>
      )}
      {autoIcon && <div className="flex-shrink-0">{autoIcon}</div>}
      <div className="flex-1">
        <h3 className="font-medium text-sm">{title}</h3>
        {description && <p className="text-xs mt-1 opacity-80">{description}</p>}
        
        {/* Add progress bar for auto-dismiss animation */}
        <div className="w-full h-0.5 bg-gray-200/50 rounded-full mt-2 overflow-hidden">
          <div 
            className={cn(
              "h-full rounded-full animate-shrink-x",
              variant === "success" && "bg-green-500",
              variant === "error" && "bg-red-500",
              variant === "warning" && "bg-yellow-500", 
              variant === "info" && "bg-blue-500",
              variant === "default" && "bg-gray-500"
            )}
            style={{ animationDuration: '5s' }}
          />
        </div>
      </div>
      {showCloseButton && onClose && (
        <button
          onClick={onClose}
          className="flex-shrink-0 h-5 w-5 rounded-full hover:bg-gray-200 flex items-center justify-center transition-colors"
          aria-label="Close notification"
        >
          <X className="h-3 w-3" />
        </button>
      )}
    </div>
  );
}
