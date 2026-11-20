import React from "react";
import { cn } from "@/lib/utils";

interface LiquidCardProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  className?: string;
  hoverGlow?: boolean;
}

export function LiquidCard({
  children,
  className,
  hoverGlow = false,
  ...props
}: LiquidCardProps) {
  return (
    <div
      className={cn(
        "rounded-3xl border border-teal-500/15 bg-[#0E1A1D]/80 p-8",
        "backdrop-blur-[14px] shadow-[inset_0_1px_1px_rgba(45,212,191,0.08),0_20px_40px_-15px_rgba(2,15,17,0.5)]",
        "transition-all duration-400 ease-[cubic-bezier(0.34,1.56,0.64,1)]",
        hoverGlow && "hover:border-teal-400/35 hover:bg-[#132226] hover:shadow-[inset_0_1px_1px_rgba(45,212,191,0.15),0_20px_40px_-12px_rgba(45,212,191,0.15)]",
        className
      )}
      {...props}
    >
      {children}
    </div>
  );
}
