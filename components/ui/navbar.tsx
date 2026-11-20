"use client";

import Link from "next/link";
import { useEffect, useState } from "react";
import { PremiumNavLink } from "./premium-nav-link";
import { LiquidButton } from "./liquid-button";

export function Navbar() {
  const [user, setUser] = useState<{ id: string; name: string; slug: string } | null>(null);

  useEffect(() => {
    fetch("/api/auth/me")
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.success && data?.user) {
          setUser(data.user);
        }
      })
      .catch(() => setUser(null));
  }, []);

  return (
    <header className="fixed top-0 left-0 right-0 z-50 bg-gradient-to-b from-[#0A1214]/95 via-[#0A1214]/80 to-transparent backdrop-blur-md border-b border-teal-500/15 transition-all duration-400">
      <div className="mx-auto flex max-w-[1280px] items-center justify-between px-6 py-6 md:px-16 md:py-7 lg:px-24">
        {/* Logo */}
        <Link href="/" className="group flex items-center gap-1">
          <span className="font-serif text-3xl md:text-4xl font-normal tracking-tight text-[#F0FDFA] transition-opacity duration-300 group-hover:opacity-90">
            Appointly<span className="text-teal-400">.</span>
          </span>
        </Link>

        {/* Center Nav Items */}
        <nav className="hidden md:flex items-center gap-12 lg:gap-20">
          <PremiumNavLink href="/#services">Services</PremiumNavLink>
          <PremiumNavLink href="/#features">Features</PremiumNavLink>
          <PremiumNavLink href="/#experience">Experience</PremiumNavLink>
          {user && (
            <PremiumNavLink href="/dashboard">Dashboard</PremiumNavLink>
          )}
        </nav>

        {/* Right CTA */}
        <div className="flex items-center gap-4">
          {user ? (
            <div className="flex items-center gap-3">
              <Link href="/dashboard">
                <LiquidButton size="sm" variant="primary">
                  Dashboard →
                </LiquidButton>
              </Link>
            </div>
          ) : (
            <div className="flex items-center gap-3">
              <Link href="/login" className="hidden sm:inline-block">
                <span className="font-serif text-lg text-teal-200/70 hover:text-white transition-colors duration-300 px-3 py-1">
                  Sign In
                </span>
              </Link>
              <Link href="/signup">
                <LiquidButton size="sm" variant="primary">
                  Get Started
                </LiquidButton>
              </Link>
            </div>
          )}
        </div>
      </div>
    </header>
  );
}
