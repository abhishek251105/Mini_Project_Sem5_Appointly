"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { LiquidCard } from "@/components/ui/liquid-card";
import { LiquidButton } from "@/components/ui/liquid-button";
import { formatPrice, formatDuration } from "@/lib/utils";
import { Clock, CreditCard, MapPin, Globe, ArrowRight, Share2, Check } from "lucide-react";

interface PublicHost {
  name: string;
  slug: string;
  timeZone: string;
  meetingTypes: {
    id: string;
    title: string;
    description?: string | null;
    duration: number;
    location?: string | null;
    priceInPaise: number;
    currency: string;
  }[];
}

export default function HostPublicPage() {
  const params = useParams();
  const slug = params?.slug as string;

  const [host, setHost] = useState<PublicHost | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(false);
  const [copied, setCopied] = useState(false);

  useEffect(() => {
    if (!slug) return;
    fetch(`/api/public/host/${slug}`)
      .then((res) => {
        if (!res.ok) throw new Error("Not found");
        return res.json();
      })
      .then((data) => {
        if (data.success && data.host) {
          setHost(data.host);
        } else {
          setError(true);
        }
      })
      .catch(() => setError(true))
      .finally(() => setLoading(false));
  }, [slug]);

  const handleShare = () => {
    navigator.clipboard.writeText(window.location.href);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A1214] flex items-center justify-center">
        <p className="font-serif text-2xl text-teal-200/50 animate-pulse">Loading host calendar...</p>
      </div>
    );
  }

  if (error || !host) {
    return (
      <div className="min-h-screen bg-[#0A1214] flex flex-col items-center justify-center px-6 text-center">
        <h1 className="font-serif text-5xl text-[#F0FDFA]">Host Not Found</h1>
        <p className="mt-3 text-sm text-teal-100/50 max-w-sm">
          The booking link you followed does not exist or may have been renamed.
        </p>
        <Link href="/" className="mt-8">
          <LiquidButton size="md" variant="secondary">
            Return to Appointly
          </LiquidButton>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A1214] text-[#F0FDFA] selection:bg-teal-500/30 selection:text-teal-200 pb-24">
      {/* Editorial Navigation */}
      <header className="border-b border-teal-500/15 bg-[#0A1214]/85 backdrop-blur-md px-6 py-5 md:px-16">
        <div className="mx-auto max-w-[1100px] flex items-center justify-between">
          <Link href="/" className="font-serif text-2xl text-[#F0FDFA] tracking-tight">
            Appointly<span className="text-teal-400">.</span>
          </Link>
          <button
            onClick={handleShare}
            className="liquid-glass px-4 py-2 text-xs flex items-center gap-2 hover:bg-teal-950/40 hover:border-teal-400/30 transition-colors cursor-pointer"
          >
            {copied ? (
              <Check className="h-3.5 w-3.5 text-teal-400" />
            ) : (
              <Share2 className="h-3.5 w-3.5 text-teal-400/70" />
            )}
            <span>{copied ? "Link Copied" : "Share"}</span>
          </button>
        </div>
      </header>

      {/* Host Profile Header */}
      <main className="mx-auto max-w-[1100px] px-6 md:px-16 pt-16">
        <div className="border-b border-teal-500/15 pb-12">
          <div className="flex items-center gap-2 text-xs font-mono text-teal-400 uppercase tracking-widest">
            <Globe className="h-3.5 w-3.5 text-teal-400" />
            <span>{host.timeZone}</span>
          </div>

          <h1 className="mt-4 font-serif text-5xl sm:text-6xl md:text-7xl text-[#F0FDFA] tracking-tight">
            {host.name}
          </h1>

          <p className="mt-4 text-base text-teal-100/60 max-w-xl leading-relaxed">
            Welcome to my appointment booking calendar. Select a session type below to view available
            time slots and reserve an appointment.
          </p>
        </div>

        {/* Meeting Types List */}
        <div className="mt-12">
          <span className="text-xs font-mono uppercase tracking-widest text-teal-400">
            AVAILABLE SESSION TYPES
          </span>

          {host.meetingTypes.length === 0 ? (
            <LiquidCard className="mt-6 p-12 text-center border-dashed border-teal-500/20">
              <p className="font-serif text-2xl text-teal-200/60">No active sessions available.</p>
              <p className="mt-2 text-xs text-teal-100/40">
                This host hasn&apos;t published any active meeting types for booking yet.
              </p>
            </LiquidCard>
          ) : (
            <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-6">
              {host.meetingTypes.map((mt) => (
                <Link key={mt.id} href={`/${host.slug}/${mt.id}`} className="group block">
                  <LiquidCard hoverGlow className="p-8 h-full flex flex-col justify-between">
                    <div>
                      <div className="flex items-start justify-between gap-4">
                        <h3 className="font-serif text-3xl text-[#F0FDFA] tracking-tight group-hover:text-teal-200 transition-colors">
                          {mt.title}
                        </h3>
                        <span className="text-xs font-mono px-3 py-1 rounded-full border border-teal-400/30 bg-teal-500/10 text-teal-300 shrink-0">
                          {formatPrice(mt.priceInPaise, mt.currency)}
                        </span>
                      </div>

                      {mt.description && (
                        <p className="mt-3 text-sm text-teal-100/60 leading-relaxed">
                          {mt.description}
                        </p>
                      )}

                      <div className="mt-6 flex flex-wrap items-center gap-4 text-xs font-mono text-teal-200/60">
                        <span className="flex items-center gap-1.5">
                          <Clock className="h-3.5 w-3.5 text-teal-400" />
                          {formatDuration(mt.duration)}
                        </span>
                        {mt.location && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1.5">
                              <MapPin className="h-3.5 w-3.5 text-teal-400" />
                              {mt.location}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="mt-8 pt-6 border-t border-teal-500/10 flex items-center justify-between text-xs text-teal-200/60 group-hover:text-white transition-colors">
                      <span className="font-mono text-teal-400">SELECT TIME</span>
                      <ArrowRight className="h-4 w-4 text-teal-400 transition-transform group-hover:translate-x-1" />
                    </div>
                  </LiquidCard>
                </Link>
              ))}
            </div>
          )}
        </div>
      </main>
    </div>
  );
}
