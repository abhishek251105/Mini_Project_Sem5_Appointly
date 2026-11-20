"use client";

import { useState, Suspense } from "react";
import Link from "next/link";
import { useRouter, useSearchParams } from "next/navigation";
import { Navbar } from "@/components/ui/navbar";
import { LiquidButton } from "@/components/ui/liquid-button";
import { LiquidCard } from "@/components/ui/liquid-card";
import { ArrowRight, Lock, Mail, User, AlertCircle } from "lucide-react";

function SignupForm() {
  const searchParams = useSearchParams();
  const initialSlug = searchParams.get("slug") || "";

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const router = useRouter();

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError("");
    setLoading(true);

    try {
      // 1. Register user
      const registerRes = await fetch("/api/auth/register", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ name, email, password }),
      });

      const registerData = await registerRes.json();

      if (!registerRes.ok || !registerData.success) {
        setError(registerData.message || "Registration failed. Password must be at least 8 characters.");
        setLoading(false);
        return;
      }

      // 2. Automatically log in to establish cookie session
      const loginRes = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      if (loginRes.ok) {
        router.push("/dashboard");
      } else {
        router.push("/login");
      }
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  return (
    <LiquidCard className="p-8 sm:p-10 border-teal-500/20">
      {error && (
        <div className="mb-6 flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-xs text-red-200">
          <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
          <span>{error}</span>
        </div>
      )}

      <form onSubmit={handleSubmit} className="space-y-5">
        <div>
          <label className="block text-xs uppercase tracking-wider text-teal-200/70 font-mono mb-2">
            Full Name
          </label>
          <div className="relative">
            <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-teal-400/40" />
            <input
              type="text"
              required
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="Eleanor Vance"
              className="liquid-glass-input w-full pl-11 pr-4 py-3 text-sm focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs uppercase tracking-wider text-teal-200/70 font-mono mb-2">
            Email Address
          </label>
          <div className="relative">
            <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-teal-400/40" />
            <input
              type="email"
              required
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="eleanor@domain.com"
              className="liquid-glass-input w-full pl-11 pr-4 py-3 text-sm focus:outline-none"
            />
          </div>
        </div>

        <div>
          <label className="block text-xs uppercase tracking-wider text-teal-200/70 font-mono mb-2">
            Password (minimum 8 characters)
          </label>
          <div className="relative">
            <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-teal-400/40" />
            <input
              type="password"
              required
              minLength={8}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              className="liquid-glass-input w-full pl-11 pr-4 py-3 text-sm focus:outline-none"
            />
          </div>
        </div>

        <div className="pt-2">
          <LiquidButton
            type="submit"
            size="md"
            variant="primary"
            className="w-full"
            disabled={loading}
          >
            {loading ? "Creating Account..." : "Create Host Profile"}
            {!loading && <ArrowRight className="h-4 w-4 ml-1" />}
          </LiquidButton>
        </div>
      </form>

      <div className="mt-6 pt-6 border-t border-teal-500/15 text-center text-xs text-teal-200/50">
        Already have an account?{" "}
        <Link href="/login" className="text-teal-300 hover:text-teal-200 hover:underline transition-colors">
          Sign in here →
        </Link>
      </div>
    </LiquidCard>
  );
}

export default function SignupPage() {
  return (
    <div className="relative min-h-screen bg-[#0A1214] text-[#F0FDFA] flex flex-col justify-between selection:bg-teal-500/30 selection:text-teal-200">
      <Navbar />

      <main className="flex-1 flex items-center justify-center px-6 pt-32 pb-16">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <span className="text-xs uppercase tracking-widest text-teal-400 font-mono">
              BECOME A HOST
            </span>
            <h1 className="mt-3 font-serif text-4xl sm:text-5xl text-[#F0FDFA] tracking-tight">
              Claim your presence.
            </h1>
            <p className="mt-2 text-sm text-teal-100/60">
              Create your editorial calendar and share your link with clients.
            </p>
          </div>

          <Suspense
            fallback={
              <LiquidCard className="p-12 text-center">
                <p className="font-serif text-xl text-teal-200/50">Loading registration...</p>
              </LiquidCard>
            }
          >
            <SignupForm />
          </Suspense>
        </div>
      </main>

      <footer className="py-8 text-center text-xs text-teal-200/40 font-mono">
        © 2026 Appointly. Editorial Appointment Scheduling.
      </footer>
    </div>
  );
}
