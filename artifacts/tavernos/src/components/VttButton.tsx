import * as React from "react";
import { Slot } from "@radix-ui/react-slot";
import { cn } from "@/lib/utils";
import { motion } from "framer-motion";

export interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  asChild?: boolean;
  variant?: "default" | "outline" | "ghost" | "destructive" | "magic";
  size?: "default" | "sm" | "lg" | "icon";
}

export const VttButton = React.forwardRef<HTMLButtonElement, ButtonProps>(
  ({ className, variant = "default", size = "default", asChild = false, ...props }, ref) => {
    const Comp = asChild ? Slot : "button";
    
    const baseStyles = "inline-flex items-center justify-center rounded-sm font-label text-sm uppercase tracking-wider font-semibold transition-all duration-300 focus-visible:outline-none disabled:pointer-events-none disabled:opacity-50";
    
    const variants = {
      default: "bg-gradient-to-b from-primary to-[#9A7D33] text-primary-foreground shadow-[0_0_15px_rgba(201,168,76,0.3)] hover:shadow-[0_0_25px_rgba(201,168,76,0.6)] border border-primary/50 hover:-translate-y-0.5",
      outline: "border-2 border-border bg-transparent hover:bg-border/20 text-primary hover:text-primary-foreground hover:border-primary shadow-sm",
      ghost: "hover:bg-card hover:text-primary text-muted-foreground",
      destructive: "bg-gradient-to-b from-destructive to-[#5A1111] text-destructive-foreground shadow-[0_0_15px_rgba(139,26,26,0.4)] hover:shadow-[0_0_25px_rgba(139,26,26,0.8)] border border-destructive/50",
      magic: "bg-gradient-to-b from-[#7D5AE0] to-magic text-white shadow-[0_0_15px_rgba(91,63,166,0.5)] hover:shadow-[0_0_25px_rgba(91,63,166,0.8)] border border-magic/50",
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
