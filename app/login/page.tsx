"use client";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { Navbar } from "@/components/ui/navbar";
import { LiquidButton } from "@/components/ui/liquid-button";
import { LiquidCard } from "@/components/ui/liquid-card";
import { ArrowRight, Lock, Mail, AlertCircle } from "lucide-react";

export default function LoginPage() {
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
      const res = await fetch("/api/auth/login", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, password }),
      });

      const data = await res.json();

      if (!res.ok || !data.success) {
        setError(data.message || "Invalid email or password");
        setLoading(false);
        return;
      }

      router.push("/dashboard");
    } catch {
      setError("Network error. Please try again.");
      setLoading(false);
    }
  };

  return (
    <div className="relative min-h-screen bg-[#0A1214] text-[#F0FDFA] flex flex-col justify-between selection:bg-teal-500/30 selection:text-teal-200">
      <Navbar />

      <main className="flex-1 flex items-center justify-center px-6 pt-32 pb-16">
        <div className="w-full max-w-md">
          <div className="text-center mb-8">
            <span className="text-xs uppercase tracking-widest text-teal-400 font-mono">
              HOST ACCESS
            </span>
            <h1 className="mt-3 font-serif text-4xl sm:text-5xl text-[#F0FDFA] tracking-tight">
              Welcome back.
            </h1>
            <p className="mt-2 text-sm text-teal-100/60">
              Sign in to manage your appointments, availability, and earnings.
            </p>
          </div>

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
                  Email Address
                </label>
                <div className="relative">
                  <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-teal-400/40" />
                  <input
                    type="email"
                    required
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@domain.com"
                    className="liquid-glass-input w-full pl-11 pr-4 py-3 text-sm focus:outline-none"
                  />
                </div>
              </div>

              <div>
                <label className="block text-xs uppercase tracking-wider text-teal-200/70 font-mono mb-2">
                  Password
                </label>
                <div className="relative">
                  <Lock className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-teal-400/40" />
                  <input
                    type="password"
                    required
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
                  {loading ? "Authenticating..." : "Sign In to Dashboard"}
                  {!loading && <ArrowRight className="h-4 w-4 ml-1" />}
                </LiquidButton>
              </div>
            </form>

            <div className="mt-6 pt-6 border-t border-teal-500/15 text-center text-xs text-teal-200/50">
              Don&apos;t have an account yet?{" "}
              <Link href="/signup" className="text-teal-300 hover:text-teal-200 hover:underline transition-colors">
                Register as a host →
              </Link>
            </div>
          </LiquidCard>
        </div>
      </main>

      <footer className="py-8 text-center text-xs text-teal-200/40 font-mono">
        © 2026 Appointly. Editorial Appointment Scheduling.
      </footer>
    </div>
  );
}
