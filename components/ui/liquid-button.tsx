import React from "react";
import { cn } from "@/lib/utils";

interface LiquidButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  children: React.ReactNode;
  variant?: "primary" | "secondary" | "danger";
  size?: "sm" | "md" | "lg";
  className?: string;
}

export function LiquidButton({
  children,
  variant = "primary",
  size = "md",
  className,
  ...props
}: LiquidButtonProps) {
  const sizeStyles = {
    sm: "px-4 py-2 text-xs",
    md: "px-6 py-3 text-sm",
    lg: "px-8 py-4 text-base tracking-wide",
  };

  const variantStyles = {
    primary:
      "border border-teal-400/30 bg-gradient-to-r from-teal-500 to-emerald-500 text-teal-950 font-semibold hover:scale-[1.02] hover:from-teal-400 hover:to-emerald-400",
    secondary:
      "border border-teal-500/20 bg-teal-950/40 text-teal-200 backdrop-blur-md hover:border-teal-400/40 hover:bg-teal-900/40 hover:text-white",
    danger:
      "border border-red-500/30 bg-red-950/40 text-red-200 backdrop-blur-md hover:border-red-500/60 hover:bg-red-900/40",
  };

  return (
    <button
      className={cn(
        "rounded-full font-medium inline-flex items-center justify-center gap-2 cursor-pointer select-none",
        "transition-all duration-400 ease-[cubic-bezier(0.34,1.56,0.64,1)] active:scale-[0.98] disabled:opacity-40 disabled:pointer-events-none",
        sizeStyles[size],
        variantStyles[variant],
        className
      )}
      {...props}
    >
      {children}
    </button>
  );
}
