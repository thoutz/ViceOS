import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  variant?: "default" | "outline" | "ghost" | "destructive" | "magic";
  size?: "default" | "sm" | "lg" | "icon";
}

export const VttButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";

    const baseStyles = "inline-flex items-center justify-center rounded font-sans text-sm font-semibold uppercase tracking-wide transition-all duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background disabled:pointer-events-none disabled:opacity-50";

    const variants = {
      default:
        "bg-primary text-primary-foreground shadow-sm hover:bg-primary/90 hover:shadow-md active:scale-[0.98]",
      outline:
        "border-2 border-primary bg-transparent text-primary hover:bg-primary hover:text-primary-foreground shadow-sm active:scale-[0.98]",
      ghost:
        "bg-transparent text-muted-foreground hover:bg-muted hover:text-foreground",
      destructive:
        "bg-destructive text-destructive-foreground shadow-sm hover:bg-destructive/90 hover:shadow-md active:scale-[0.98]",
      magic:
        "bg-magic text-white shadow-sm hover:bg-magic/90 hover:shadow-md border border-magic/30 active:scale-[0.98]",
    };

    const sizes = {
      default: "h-10 px-6 py-2",
      sm: "h-8 px-3 text-xs",
      lg: "h-12 px-8 text-base",
      icon: "h-10 w-10",
    };

    return (
      <Comp
        className={cn(baseStyles, variants[variant], sizes[size], className)}
        ref={ref}
        {...props}
      />
    );
  }
);
VttButton.displayName = "VttButton";
