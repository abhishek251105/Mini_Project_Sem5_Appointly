"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { LiquidCard } from "@/components/ui/liquid-card";
import { LiquidButton } from "@/components/ui/liquid-button";
import { formatPrice } from "@/lib/utils";
import { CheckCircle, Calendar, Clock, MapPin, User } from "lucide-react";

interface BookingRecap {
  id: string;
  guestName: string;
  guestEmail: string;
  startTime: string;
  endTime: string;
  status: string;
  notes?: string | null;
  meetingType: {
    title: string;
    duration: number;
    location?: string | null;
    priceInPaise: number;
    currency: string;
  };
  host: {
    name: string;
    slug: string;
    timeZone: string;
  };
}

export default function BookingConfirmedPage() {
  const params = useParams();
  const id = params?.id as string;

  const [booking, setBooking] = useState<BookingRecap | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!id) return;
    // Fetch booking details from public endpoint
    fetch(`/api/public/booking/${id}`)
      .then((res) => (res.ok ? res.json() : null))
      .then((data) => {
        if (data?.booking) {
          setBooking(data.booking);
        }
      })
      .catch(() => setBooking(null))
      .finally(() => setLoading(false));
  }, [id]);

  // Generate Google Calendar Link
  const googleCalendarUrl = () => {
    if (!booking) return "#";
    const startIso = new Date(booking.startTime).toISOString().replace(/-|:|\.\d\d\d/g, "");
    const endIso = new Date(booking.endTime).toISOString().replace(/-|:|\.\d\d\d/g, "");
    const title = encodeURIComponent(`${booking.meetingType.title} with ${booking.host.name}`);
    const details = encodeURIComponent(booking.notes || `Scheduled via Appointly.`);
    const location = encodeURIComponent(booking.meetingType.location || "");

    return `https://calendar.google.com/calendar/render?action=TEMPLATE&text=${title}&dates=${startIso}/${endIso}&details=${details}&location=${location}`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A1214] text-[#F0FDFA] flex items-center justify-center">
        <div className="h-8 w-8 animate-spin rounded-full border-2 border-teal-400 border-t-transparent" />
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A1214] text-[#F0FDFA] selection:bg-teal-500/30 selection:text-teal-200 flex flex-col justify-between">
      {/* Top bar */}
      <header className="border-b border-teal-500/15 bg-[#0A1214]/85 px-6 py-5 md:px-16">
        <div className="mx-auto max-w-[900px] flex items-center justify-between">
          <Link href="/" className="font-serif text-2xl text-[#F0FDFA]">
            Appointly<span className="text-teal-400">.</span>
          </Link>
          <span className="text-xs font-mono text-teal-400 uppercase tracking-widest">
            RECEIPT & CONFIRMATION
          </span>
        </div>
      </header>

      {/* Main Content */}
      <main className="flex-1 flex items-center justify-center px-6 py-16">
        <div className="w-full max-w-xl">
          <div className="text-center mb-8">
            <div className="inline-flex items-center justify-center h-14 w-14 rounded-full border border-teal-400/40 bg-teal-500/20 text-teal-300 mb-4 shadow-[0_0_24px_rgba(45,212,191,0.3)]">
              <CheckCircle className="h-7 w-7" />
            </div>
            <span className="block text-xs uppercase tracking-widest text-teal-400 font-mono">
              APPOINTMENT CONFIRMED
            </span>
            <h1 className="mt-2 font-serif text-4xl sm:text-5xl text-[#F0FDFA] tracking-tight">
              You&apos;re scheduled.
            </h1>
            <p className="mt-2 text-sm text-teal-100/60">
              A calendar invitation and confirmation receipt have been dispatched to your email.
            </p>
          </div>

          <LiquidCard className="p-8 space-y-6">
            <div className="pb-6 border-b border-teal-500/15">
              <span className="text-xs font-mono uppercase text-teal-400/70">SESSION OVERVIEW</span>
              <h2 className="mt-1 font-serif text-2xl sm:text-3xl text-[#F0FDFA]">
                {booking?.meetingType.title || "Consultation"}
              </h2>
              <p className="text-xs font-mono text-teal-300 mt-1">
                with {booking?.host.name || "the Host"}
              </p>
            </div>

            <div className="space-y-4 text-xs font-mono text-teal-100/80">
              {booking && (
                <div className="flex items-center gap-3">
                  <Clock className="h-4 w-4 text-teal-400" />
                  <span>
                    {new Date(booking.startTime).toLocaleString("en-US", {
                      dateStyle: "full",
                      timeStyle: "short",
                    })}
                  </span>
                </div>
              )}

              {booking?.meetingType.location && (
                <div className="flex items-center gap-3">
                  <MapPin className="h-4 w-4 text-teal-400" />
                  <span>{booking.meetingType.location}</span>
                </div>
              )}

              {booking?.meetingType.priceInPaise !== undefined && (
                <div className="flex items-center gap-3">
                  <span className="text-teal-400/70">Amount:</span>
                  <span className="text-teal-300 font-bold">
                    {formatPrice(booking.meetingType.priceInPaise, booking.meetingType.currency)}
                  </span>
                </div>
              )}

              {booking?.guestName && (
                <div className="flex items-center gap-3">
                  <User className="h-4 w-4 text-teal-400" />
                  <span>
                    {booking.guestName} ({booking.guestEmail})
                  </span>
                </div>
              )}
            </div>

            <div className="pt-6 border-t border-teal-500/15 flex flex-col sm:flex-row items-center gap-3">
              <a
                href={googleCalendarUrl()}
                target="_blank"
                rel="noopener noreferrer"
                className="w-full sm:w-auto flex-1"
              >
                <LiquidButton size="md" variant="primary" className="w-full">
                  <Calendar className="h-4 w-4 mr-1.5" />
                  Add to Google Calendar
                </LiquidButton>
              </a>

              {booking?.host.slug && (
                <Link href={`/${booking.host.slug}`} className="w-full sm:w-auto">
                  <LiquidButton size="md" variant="secondary" className="w-full">
                    Return to Host
                  </LiquidButton>
                </Link>
              )}
            </div>
          </LiquidCard>
        </div>
      </main>

      <footer className="py-6 text-center text-xs text-teal-200/40 font-mono border-t border-teal-500/15">
        © 2026 Appointly. Editorial Appointment Scheduling.
      </footer>
    </div>
  );
}
