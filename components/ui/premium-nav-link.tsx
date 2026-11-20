"use client";

import Link from "next/link";
import { useState } from "react";

interface PremiumNavLinkProps {
  href: string;
  children: React.ReactNode;
  className?: string;
  onClick?: () => void;
}

export function PremiumNavLink({
  href,
  children,
  className = "",
  onClick,
}: PremiumNavLinkProps) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <Link
      href={href}
      onClick={onClick}
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
      className={`relative inline-block font-serif text-xl font-semibold tracking-wide transition-all ${className}`}
      style={{
        color: isHovered ? "rgba(240, 253, 250, 1)" : "rgba(204, 251, 241, 0.65)",
        transform: isHovered ? "scale(1.2)" : "scale(1)",
        filter: isHovered
          ? "drop-shadow(0 0 10px rgba(45, 212, 191, 0.4))"
          : "none",
        transitionDuration: "400ms",
        transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)",
      }}
    >
      <span>{children}</span>

      {/* Seafoam underline growing from 0% to 80% */}
      <span
        className="pointer-events-none absolute bottom-0 left-1/2 -translate-x-1/2 h-[1.5px] bg-teal-400 transition-all"
        style={{
          width: isHovered ? "80%" : "0%",
          opacity: isHovered ? 1 : 0,
          transitionDuration: "400ms",
          transitionTimingFunction: "cubic-bezier(0.34, 1.56, 0.64, 1)",
        }}
      />
    </Link>
  );
}
