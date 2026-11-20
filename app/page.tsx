"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/ui/navbar";
import { HeroTextShuffler } from "@/components/ui/text-shuffler";
import { LiquidButton } from "@/components/ui/liquid-button";
import { LiquidCard } from "@/components/ui/liquid-card";
import {
  Calendar,
  CreditCard,
  Globe,
  Bell,
  ArrowRight,
  Clock,
  Sparkles,
  Check,
} from "lucide-react";

export default function HomePage() {
  const [handle, setHandle] = useState("");
  const router = useRouter();

  const handleClaim = (e: React.FormEvent) => {
    e.preventDefault();
    if (handle.trim()) {
      router.push(`/signup?slug=${encodeURIComponent(handle.trim().toLowerCase())}`);
    } else {
      router.push("/signup");
    }
  };

  return (
    <div className="relative min-h-screen bg-[#0A1214] text-[#F0FDFA] selection:bg-teal-500/30 selection:text-teal-200">
      {/* Fixed Navigation */}
      <Navbar />

      {/* Hero Section */}
      <section className="relative min-h-screen flex items-center pt-28 pb-16 overflow-hidden">
        {/* Ambient Seafoam Glow Mesh */}
        <div className="pointer-events-none absolute inset-0 z-0">
          <div className="absolute top-1/4 -left-20 h-[450px] w-[450px] rounded-full bg-teal-500/[0.08] blur-[140px]" />
          <div className="absolute top-1/3 right-0 h-[550px] w-[550px] rounded-full bg-emerald-500/[0.06] blur-[160px]" />
          <div className="absolute -bottom-10 left-1/3 h-96 w-96 rounded-full bg-teal-400/[0.05] blur-[120px]" />
          <div
            className="absolute inset-0 opacity-[0.04]"
            style={{
              backgroundImage: `radial-gradient(circle at 1px 1px, #2DD4BF 1px, transparent 0)`,
              backgroundSize: "36px 36px",
            }}
          />
        </div>

        <div className="relative z-10 mx-auto max-w-[1280px] w-full px-6 md:px-16 lg:px-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-8 items-center min-h-[75vh]">
            {/* Left Column: 4 Stacked lines with increasing indentation & seafoam depth */}
            <div className="lg:col-span-7 flex flex-col justify-center">
              <div className="space-y-1 select-none">
                {/* Line 1: 0px indentation */}
                <div className="pl-0">
                  <h1 className="font-serif leading-[0.88] tracking-[-0.04em] text-[#F0FDFA] text-[4rem] sm:text-[5.5rem] md:text-[7rem] lg:text-[8rem] xl:text-[9.5rem]">
                    TIME.
                  </h1>
                </div>

                {/* Line 2: 64px indentation on desktop */}
                <div className="pl-0 sm:pl-8 md:pl-16">
                  <h1 className="font-serif leading-[0.88] tracking-[-0.04em] text-teal-100 text-[3.6rem] sm:text-[5rem] md:text-[6.4rem] lg:text-[7.4rem] xl:text-[8.5rem]">
                    UNBROKEN.
                  </h1>
                </div>

                {/* Line 3: 128px indentation on desktop */}
                <div className="pl-0 sm:pl-16 md:pl-32">
                  <h1 className="font-serif leading-[0.88] tracking-[-0.04em] text-teal-200/80 text-[3.2rem] sm:text-[4.5rem] md:text-[5.8rem] lg:text-[6.8rem] xl:text-[7.8rem]">
                    SCHEDULE.
                  </h1>
                </div>

                {/* Line 4: 192px indentation on desktop */}
                <div className="pl-0 sm:pl-24 md:pl-48">
                  <h1 className="font-serif leading-[0.88] tracking-[-0.04em] text-teal-300/60 text-[2.8rem] sm:text-[4rem] md:text-[5.2rem] lg:text-[6.2rem] xl:text-[7.2rem]">
                    REFINED.
                  </h1>
                </div>
              </div>
            </div>

            {/* Right Column: Hero Text Shuffler + Liquid Glass CTA */}
            <div className="lg:col-span-5 flex flex-col justify-center gap-8 lg:pl-6">
              <div className="border-l border-teal-500/25 pl-6">
                <span className="text-xs uppercase tracking-widest text-teal-400 font-mono flex items-center gap-2">
                  <span className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-pulse" />
                  THE EDITORIAL CALENDAR
                </span>
                <div className="mt-3">
                  <HeroTextShuffler />
                </div>
                <p className="mt-4 text-sm md:text-base text-teal-100/60 leading-relaxed max-w-md">
                  Effortless appointment booking with native Razorpay commerce,
                  cross-timezone synchronization, and luminous clarity.
                </p>
              </div>

              {/* Claim Handle Bar */}
              <form
                onSubmit={handleClaim}
                className="relative flex flex-col sm:flex-row gap-3 max-w-md"
              >
                <div className="relative flex-1">
                  <span className="absolute left-4 top-1/2 -translate-y-1/2 text-sm text-teal-400/50 font-mono">
                    appointly.me/
                  </span>
                  <input
                    type="text"
                    value={handle}
                    onChange={(e) => setHandle(e.target.value)}
                    placeholder="yourname"
                    className="liquid-glass-input w-full pl-32 pr-4 py-3.5 text-sm font-sans focus:outline-none"
                  />
                </div>
                <LiquidButton size="md" variant="primary" type="submit">
                  <span>Claim</span>
                  <ArrowRight className="h-4 w-4" />
                </LiquidButton>
              </form>

              <div className="flex items-center gap-6 text-xs text-teal-200/50 pt-2">
                <div className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-teal-400" />
                  <span>Razorpay checkout</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-teal-400" />
                  <span>Instant confirmations</span>
                </div>
                <div className="flex items-center gap-1.5">
                  <Check className="h-3.5 w-3.5 text-teal-400" />
                  <span>Timezone sync</span>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Service Grids: 4-column desktop, 1-column mobile */}
      <section id="services" className="relative py-24 border-t border-teal-500/15">
        <div className="mx-auto max-w-[1280px] px-6 md:px-16 lg:px-24">
          <div className="flex flex-col md:flex-row md:items-end justify-between mb-16 gap-6">
            <div>
              <span className="text-xs uppercase tracking-widest text-teal-400 font-mono">
                ENGINEERED PRECISION
              </span>
              <h2 className="mt-3 font-serif text-4xl sm:text-5xl lg:text-6xl text-[#F0FDFA] tracking-tight">
                Architected for high-signal professionals.
              </h2>
            </div>
            <p className="text-sm md:text-base text-teal-100/60 max-w-md">
              Every interaction is tuned for peace of mind. Low cognitive overhead, high conversion,
              and frictionless client reservations.
            </p>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
            {/* Card 1 */}
            <LiquidCard hoverGlow className="group">
              <div className="flex flex-col justify-between h-full space-y-8">
                <div>
                  <Calendar className="h-8 w-8 text-teal-400 opacity-60 transition-all duration-300 group-hover:opacity-100 group-hover:scale-110" />
                  <h3 className="mt-6 font-serif text-2xl text-[#F0FDFA] tracking-tight">
                    Conflict-Free Sync
                  </h3>
                  <p className="mt-3 text-sm text-teal-100/60 leading-relaxed">
                    Double-booking prevention engine. Real-time availability calculation
                    respects both recurring weekly hours and custom date overrides.
                  </p>
                </div>
                <div className="pt-4 border-t border-teal-500/10 text-xs font-mono text-teal-400/50 group-hover:text-teal-300 transition-colors">
                  01 / AVAILABILITY
                </div>
              </div>
            </LiquidCard>

            {/* Card 2 */}
            <LiquidCard hoverGlow className="group">
              <div className="flex flex-col justify-between h-full space-y-8">
                <div>
                  <CreditCard className="h-8 w-8 text-teal-400 opacity-60 transition-all duration-300 group-hover:opacity-100 group-hover:scale-110" />
                  <h3 className="mt-6 font-serif text-2xl text-[#F0FDFA] tracking-tight">
                    Razorpay Integration
                  </h3>
                  <p className="mt-3 text-sm text-teal-100/60 leading-relaxed">
                    Monetize appointments effortlessly. Automated 15-minute slot reservation
                    locks and instant webhook payment verification.
                  </p>
                </div>
                <div className="pt-4 border-t border-teal-500/10 text-xs font-mono text-teal-400/50 group-hover:text-teal-300 transition-colors">
                  02 / COMMERCE
                </div>
              </div>
            </LiquidCard>

            {/* Card 3 */}
            <LiquidCard hoverGlow className="group">
              <div className="flex flex-col justify-between h-full space-y-8">
                <div>
                  <Globe className="h-8 w-8 text-teal-400 opacity-60 transition-all duration-300 group-hover:opacity-100 group-hover:scale-110" />
                  <h3 className="mt-6 font-serif text-2xl text-[#F0FDFA] tracking-tight">
                    Global Timezones
                  </h3>
                  <p className="mt-3 text-sm text-teal-100/60 leading-relaxed">
                    Zero confusion across borders. Host availability is converted seamlessly
                    to each guest’s local timezone with precision math.
                  </p>
                </div>
                <div className="pt-4 border-t border-teal-500/10 text-xs font-mono text-teal-400/50 group-hover:text-teal-300 transition-colors">
                  03 / LOCALIZATION
                </div>
              </div>
            </LiquidCard>

            {/* Card 4 */}
            <LiquidCard hoverGlow className="group">
              <div className="flex flex-col justify-between h-full space-y-8">
                <div>
                  <Bell className="h-8 w-8 text-teal-400 opacity-60 transition-all duration-300 group-hover:opacity-100 group-hover:scale-110" />
                  <h3 className="mt-6 font-serif text-2xl text-[#F0FDFA] tracking-tight">
                    Automated Resend
                  </h3>
                  <p className="mt-3 text-sm text-teal-100/60 leading-relaxed">
                    Instant confirmation emails for both host and guest, calendar invitations,
                    and automated idempotency-guarded refunds upon cancellation.
                  </p>
                </div>
                <div className="pt-4 border-t border-teal-500/10 text-xs font-mono text-teal-400/50 group-hover:text-teal-300 transition-colors">
                  04 / DISPATCH
                </div>
              </div>
            </LiquidCard>
          </div>
        </div>
      </section>

      {/* Split Feature Section */}
      <section id="features" className="relative py-24 border-t border-teal-500/15">
        <div className="mx-auto max-w-[1280px] px-6 md:px-16 lg:px-24">
          <div className="grid grid-cols-1 lg:grid-cols-12 gap-12 lg:gap-16 items-center">
            {/* Left Column: Large serif header, body text at 60%, bulleted list with seafoam dots */}
            <div className="lg:col-span-6 space-y-6">
              <span className="text-xs uppercase tracking-widest text-teal-400 font-mono">
                THE HOST DASHBOARD
              </span>
              <h2 className="font-serif text-4xl sm:text-5xl lg:text-6xl text-[#F0FDFA] leading-[1.05] tracking-tight">
                Designed for founders, mentors, and consultants.
              </h2>
              <p className="text-base text-teal-100/60 leading-relaxed">
                Take command of your calendar with an editorial interface designed to minimize
                admin burden. Define multiple session tiers, configure variable pricing in INR,
                and review bookings with single-click actions.
              </p>

              {/* Bulleted list with seafoam dots */}
              <ul className="space-y-4 pt-2">
                {[
                  "Custom session durations with bespoke pricing (Free or Paid in INR).",
                  "Granular weekly recurring hours with instant overrides for vacations.",
                  "Automated refund reconciliation with Razorpay when sessions are cancelled.",
                  "Personalized public booking page at your vanity URL.",
                ].map((item, idx) => (
                  <li key={idx} className="flex items-start gap-4 text-sm text-teal-100/80">
                    <span className="mt-1.5 h-2 w-2 rounded-full bg-teal-400 shrink-0 shadow-[0_0_8px_rgba(45,212,191,0.6)]" />
                    <span>{item}</span>
                  </li>
                ))}
              </ul>

              <div className="pt-6">
                <Link href="/signup">
                  <LiquidButton size="lg" variant="primary">
                    Create Your Host Profile →
                  </LiquidButton>
                </Link>
              </div>
            </div>

            {/* Right Column: Seafoam Glowing Showcase */}
            <div className="lg:col-span-6 flex justify-center">
              <div className="relative aspect-square w-full max-w-[500px] rounded-3xl border border-teal-500/20 bg-[#0E1A1D]/80 p-6 backdrop-blur-[16px] shadow-[inset_0_1px_1px_rgba(45,212,191,0.1),0_20px_40px_rgba(2,15,17,0.6)] flex items-center justify-center">
                {/* Inner seafoam container */}
                <div className="relative w-full h-full rounded-2xl bg-gradient-to-br from-teal-950/60 via-[#0A1214] to-emerald-950/40 border border-teal-500/20 flex flex-col items-center justify-center p-8 overflow-hidden group">
                  {/* Subtle decorative seafoam rings */}
                  <div className="absolute h-72 w-72 rounded-full border border-teal-500/10 animate-pulse" />
                  <div className="absolute h-48 w-48 rounded-full border border-teal-500/15" />
                  <div className="absolute h-24 w-24 rounded-full border border-teal-500/20" />

                  {/* Centered iconic graphic */}
                  <div className="relative z-10 text-center flex flex-col items-center">
                    <div className="h-16 w-16 rounded-full border border-teal-400/40 bg-teal-500/20 backdrop-blur-md flex items-center justify-center shadow-[0_0_30px_rgba(45,212,191,0.3)] mb-6 transition-transform duration-500 group-hover:scale-110">
                      <Clock className="h-7 w-7 text-teal-300" />
                    </div>
                    <span className="font-serif text-3xl text-[#F0FDFA] tracking-wide">
                      10:00 AM — 10:45 AM
                    </span>
                    <span className="mt-2 text-xs font-mono text-teal-300/60 uppercase tracking-widest">
                      SLOT RESERVED • ASIA/KOLKATA
                    </span>
                    <div className="mt-6 flex items-center gap-2 rounded-full border border-teal-400/30 bg-teal-500/15 px-4 py-1.5 text-xs text-teal-300 shadow-[0_0_12px_rgba(45,212,191,0.2)]">
                      <span className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-ping" />
                      <span>Confirmed via Appointly</span>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </section>

      {/* Experience / Direct Action Section */}
      <section id="experience" className="relative py-28 border-t border-teal-500/15 text-center">
        <div className="mx-auto max-w-[800px] px-6">
          <span className="text-xs uppercase tracking-widest text-teal-400 font-mono">
            GET STARTED TODAY
          </span>
          <h2 className="mt-4 font-serif text-5xl sm:text-6xl md:text-7xl text-[#F0FDFA] tracking-tight">
            Elevate your appointments.
          </h2>
          <p className="mt-6 text-base md:text-lg text-teal-100/60 leading-relaxed max-w-xl mx-auto">
            Stop losing hours to messaging loops. Share your booking link and let your schedule
            align effortlessly.
          </p>

          <div className="mt-10 flex flex-col sm:flex-row items-center justify-center gap-4">
            <Link href="/signup">
              <LiquidButton size="lg" variant="primary">
                Get Started For Free →
              </LiquidButton>
            </Link>
            <Link href="/login">
              <LiquidButton size="lg" variant="secondary">
                Host Sign In
              </LiquidButton>
            </Link>
          </div>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t border-teal-500/15 py-12 text-center text-xs text-teal-200/40 font-mono">
        <div className="mx-auto max-w-[1280px] px-6 flex flex-col sm:flex-row items-center justify-between gap-4">
          <p>© 2026 Appointly. Editorial Appointment Scheduling.</p>
          <div className="flex items-center gap-6 text-teal-200/50">
            <Link href="/login" className="hover:text-teal-300 transition-colors">
              Host Login
            </Link>
            <Link href="/signup" className="hover:text-teal-300 transition-colors">
              Register
            </Link>
          </div>
        </div>
      </footer>
    </div>
  );
}
