"use client";

import { useEffect, useState, useMemo } from "react";
import Link from "next/link";
import Script from "next/script";
import { useParams, useRouter } from "next/navigation";
import { LiquidCard } from "@/components/ui/liquid-card";
import { LiquidButton } from "@/components/ui/liquid-button";
import { formatPrice, formatDuration } from "@/lib/utils";
import {
  Clock,
  CreditCard,
  MapPin,
  Calendar as CalendarIcon,
  ChevronLeft,
  ChevronRight,
  ArrowLeft,
  CheckCircle,
  AlertCircle,
  User,
  Mail,
  FileText,
} from "lucide-react";

interface Slot {
  startTime: string;
  endTime: string;
}

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

declare global {
  interface Window {
    Razorpay: new (options: Record<string, unknown>) => {
      open: () => void;
      on: (event: string, callback: (res: unknown) => void) => void;
    };
  }
}

export default function MeetingBookingPage() {
  const params = useParams();
  const router = useRouter();

  const slug = params?.slug as string;
  const meetingTypeId = params?.meetingTypeId as string;

  const [host, setHost] = useState<PublicHost | null>(null);
  const [loadingHost, setLoadingHost] = useState(true);

  // Calendar state
  const [currentMonth, setCurrentMonth] = useState(new Date());
  const [selectedDate, setSelectedDate] = useState<string>("");

  // Slots state
  const [slots, setSlots] = useState<Slot[]>([]);
  const [loadingSlots, setLoadingSlots] = useState(false);
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);

  // Guest Form
  const [guestName, setGuestName] = useState("");
  const [guestEmail, setGuestEmail] = useState("");
  const [notes, setNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState("");

  // Fetch host data
  useEffect(() => {
    if (!slug) return;
    fetch(`/api/public/host/${slug}`)
      .then((res) => res.json())
      .then((data) => {
        if (data.success && data.host) {
          setHost(data.host);
        }
      })
      .finally(() => setLoadingHost(false));
  }, [slug]);

  const meetingType = useMemo(() => {
    return host?.meetingTypes.find((m) => m.id === meetingTypeId);
  }, [host, meetingTypeId]);

  // Fetch slots whenever selectedDate or meetingTypeId changes
  useEffect(() => {
    if (!slug || !meetingTypeId || !selectedDate) return;
    setLoadingSlots(true);
    setSelectedSlot(null);
    setErrorMsg("");

    fetch(
      `/api/public/host/${slug}/availability?meetingTypeId=${meetingTypeId}&date=${selectedDate}`
    )
      .then((res) => res.json())
      .then((data) => {
        if (data.success && Array.isArray(data.availableSlots)) {
          setSlots(data.availableSlots);
        } else {
          setSlots([]);
        }
      })
      .catch(() => setSlots([]))
      .finally(() => setLoadingSlots(false));
  }, [slug, meetingTypeId, selectedDate]);

  // Calendar generation helpers
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();

  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const firstDayOfWeek = new Date(year, month, 1).getDay();

  const prevMonth = () => setCurrentMonth(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentMonth(new Date(year, month + 1, 1));

  const monthLabel = currentMonth.toLocaleString("en-US", {
    month: "long",
    year: "numeric",
  });

  // Handle Booking Submission (Free vs Paid)
  const handleBooking = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedSlot) {
      setErrorMsg("Please select an available time slot.");
      return;
    }

    setSubmitting(true);
    setErrorMsg("");

    try {
      // 1. Create Booking via /api/public/booking
      const bookingRes = await fetch("/api/public/booking", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          hostSlug: slug,
          meetingTypeId,
          guestName,
          guestEmail,
          startTime: selectedSlot.startTime,
          notes: notes || undefined,
        }),
      });

      const bookingData = await bookingRes.json();

      if (!bookingRes.ok || !bookingData.success) {
        setErrorMsg(bookingData.message || "Unable to reserve slot. It may have just been booked.");
        setSubmitting(false);
        return;
      }

      const booking = bookingData.booking;

      // 2. If FREE (CONFIRMED), redirect immediately
      if (booking.status === "CONFIRMED") {
        router.push(`/booking/${booking.id}/confirmed`);
        return;
      }

      // 3. If PAID (PENDING_PAYMENT), trigger Razorpay Order & Checkout
      const orderRes = await fetch("/api/payments/create-order", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          bookingId: booking.id,
          guestEmail,
        }),
      });

      const orderData = await orderRes.json();

      if (!orderRes.ok || !orderData.success) {
        setErrorMsg(orderData.message || "Failed to create payment order.");
        setSubmitting(false);
        return;
      }

      const { payment, razorpayKeyId } = orderData;

      if (!window.Razorpay) {
        setErrorMsg("Razorpay SDK not loaded. Please refresh and try again.");
        setSubmitting(false);
        return;
      }

      const rzp = new window.Razorpay({
        key: razorpayKeyId,
        amount: payment.amount,
        currency: payment.currency,
        name: "Appointly Appointment",
        description: `${meetingType?.title || "Session"} with ${host?.name}`,
        order_id: payment.razorpayOrderId,
        prefill: {
          name: guestName,
          email: guestEmail,
        },
        theme: {
          color: "#0F766E",
        },
        handler: async function (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) {
          // 4. Verify payment
          const verifyRes = await fetch("/api/payments/verify", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify(response),
          });

          const verifyData = await verifyRes.json();
          if (verifyRes.ok && verifyData.success) {
            router.push(`/booking/${booking.id}/confirmed`);
          } else {
            setErrorMsg("Payment verification failed. Please contact support.");
            setSubmitting(false);
          }
        },
      });

      rzp.open();
    } catch {
      setErrorMsg("Something went wrong during booking.");
      setSubmitting(false);
    }
  };

  if (loadingHost) {
    return (
      <div className="min-h-screen bg-[#0A1214] flex items-center justify-center">
        <p className="font-serif text-2xl text-teal-200/50 animate-pulse">Loading appointment details...</p>
      </div>
    );
  }

  if (!host || !meetingType) {
    return (
      <div className="min-h-screen bg-[#0A1214] flex flex-col items-center justify-center text-center px-6">
        <h1 className="font-serif text-4xl text-[#F0FDFA]">Session Not Found</h1>
        <p className="mt-2 text-sm text-teal-100/50">This meeting type is currently inactive or removed.</p>
        <Link href={`/${slug}`} className="mt-6">
          <LiquidButton size="sm" variant="secondary">
            View All Offerings
          </LiquidButton>
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-[#0A1214] text-[#F0FDFA] selection:bg-teal-500/30 selection:text-teal-200 pb-24">
      {/* Razorpay Checkout Script */}
      <Script src="https://checkout.razorpay.com/v1/checkout.js" strategy="lazyOnload" />

      {/* Header */}
      <header className="border-b border-teal-500/15 bg-[#0A1214]/85 backdrop-blur-md px-6 py-5 md:px-16">
        <div className="mx-auto max-w-[1200px] flex items-center justify-between">
          <Link
            href={`/${slug}`}
            className="flex items-center gap-2 text-xs font-mono text-teal-300 hover:text-white transition-colors"
          >
            <ArrowLeft className="h-3.5 w-3.5" />
            <span>BACK TO {host.name.toUpperCase()}</span>
          </Link>
          <span className="font-serif text-xl text-[#F0FDFA]">
            Appointly<span className="text-teal-400">.</span>
          </span>
        </div>
      </header>

      {/* Main Booking Container */}
      <main className="mx-auto max-w-[1200px] px-6 md:px-16 pt-10">
        <div className="grid grid-cols-1 lg:grid-cols-12 gap-8 items-start">
          {/* Left Column: Meeting Summary */}
          <div className="lg:col-span-4">
            <LiquidCard className="p-8 sticky top-8">
              <span className="text-xs font-mono uppercase tracking-widest text-teal-400">
                {host.name}
              </span>
              <h1 className="mt-2 font-serif text-3xl sm:text-4xl text-[#F0FDFA] tracking-tight">
                {meetingType.title}
              </h1>

              {meetingType.description && (
                <p className="mt-3 text-sm text-teal-100/60 leading-relaxed">
                  {meetingType.description}
                </p>
              )}

              <div className="mt-8 space-y-3 pt-6 border-t border-teal-500/15 text-xs font-mono text-teal-200/70">
                <div className="flex items-center gap-2">
                  <Clock className="h-4 w-4 text-teal-400" />
                  <span>{formatDuration(meetingType.duration)}</span>
                </div>
                <div className="flex items-center gap-2">
                  <CreditCard className="h-4 w-4 text-teal-400" />
                  <span className="text-teal-300">
                    {formatPrice(meetingType.priceInPaise, meetingType.currency)}
                  </span>
                </div>
                {meetingType.location && (
                  <div className="flex items-center gap-2">
                    <MapPin className="h-4 w-4 text-teal-400" />
                    <span>{meetingType.location}</span>
                  </div>
                )}
                <div className="flex items-center gap-2 pt-2 text-[11px] text-teal-400/60">
                  <span>Host Timezone: {host.timeZone}</span>
                </div>
              </div>
            </LiquidCard>
          </div>

          {/* Right Column: Calendar, Slot Selector & Guest Form */}
          <div className="lg:col-span-8 space-y-8">
            {/* Step 1: Date & Time Picker */}
            <LiquidCard className="p-8">
              <span className="text-xs font-mono uppercase tracking-widest text-teal-400">
                STEP 1: SELECT DATE & TIME
              </span>

              <div className="mt-6 grid grid-cols-1 md:grid-cols-2 gap-8">
                {/* Calendar */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-serif text-xl text-[#F0FDFA]">{monthLabel}</span>
                    <div className="flex items-center gap-1">
                      <button
                        onClick={prevMonth}
                        className="p-1 rounded-lg border border-teal-500/20 hover:bg-teal-950/40 text-teal-200/60 hover:text-white"
                      >
                        <ChevronLeft className="h-4 w-4" />
                      </button>
                      <button
                        onClick={nextMonth}
                        className="p-1 rounded-lg border border-teal-500/20 hover:bg-teal-950/40 text-teal-200/60 hover:text-white"
                      >
                        <ChevronRight className="h-4 w-4" />
                      </button>
                    </div>
                  </div>

                  {/* Calendar Grid */}
                  <div className="grid grid-cols-7 gap-1 text-center text-xs font-mono text-teal-400/50 mb-2">
                    {["Su", "Mo", "Tu", "We", "Th", "Fr", "Sa"].map((d) => (
                      <div key={d} className="py-1">
                        {d}
                      </div>
                    ))}
                  </div>

                  <div className="grid grid-cols-7 gap-1.5">
                    {/* Leading empty days */}
                    {Array.from({ length: firstDayOfWeek }).map((_, i) => (
                      <div key={`empty-${i}`} />
                    ))}

                    {/* Month Days */}
                    {Array.from({ length: daysInMonth }).map((_, i) => {
                      const dayNum = i + 1;
                      const dayStr = `${year}-${String(month + 1).padStart(2, "0")}-${String(
                        dayNum
                      ).padStart(2, "0")}`;
                      const isPast =
                        new Date(`${dayStr}T23:59:59`) < new Date(new Date().setHours(0, 0, 0, 0));
                      const isSelected = selectedDate === dayStr;

                      return (
                        <button
                          key={dayStr}
                          disabled={isPast}
                          onClick={() => setSelectedDate(dayStr)}
                          className={`aspect-square rounded-xl text-xs font-medium transition-all duration-300 flex items-center justify-center cursor-pointer ${
                            isSelected
                              ? "bg-gradient-to-r from-teal-500 to-emerald-500 text-teal-950 font-bold"
                              : isPast
                              ? "text-teal-950/50 cursor-not-allowed"
                              : "text-teal-100 hover:bg-teal-950/40 hover:text-white border border-teal-500/10"
                          }`}
                        >
                          {dayNum}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Available Slots */}
                <div>
                  <div className="flex items-center justify-between mb-4">
                    <span className="font-serif text-xl text-[#F0FDFA]">
                      {selectedDate
                        ? new Date(selectedDate + "T00:00:00").toLocaleDateString("en-US", {
                            weekday: "short",
                            month: "short",
                            day: "numeric",
                          })
                        : "Select a date"}
                    </span>
                    {loadingSlots && (
                      <span className="text-[10px] font-mono text-teal-400 animate-pulse">
                        Calculating...
                      </span>
                    )}
                  </div>

                  {!selectedDate ? (
                    <div className="h-48 flex items-center justify-center text-xs font-mono text-teal-200/40 border border-dashed border-teal-500/20 rounded-2xl">
                      Choose a date to view slots
                    </div>
                  ) : loadingSlots ? (
                    <div className="h-48 flex items-center justify-center text-xs font-mono text-teal-200/40">
                      Loading available windows...
                    </div>
                  ) : slots.length === 0 ? (
                    <div className="h-48 flex flex-col items-center justify-center text-xs font-mono text-teal-200/40 border border-dashed border-teal-500/20 rounded-2xl p-4 text-center">
                      <span>No available slots on this date.</span>
                      <span className="mt-1 text-[11px] text-teal-400/40">
                        Please select another date.
                      </span>
                    </div>
                  ) : (
                    <div className="grid grid-cols-2 gap-2 max-h-64 overflow-y-auto pr-1">
                      {slots.map((slot) => {
                        const timeStr = new Date(slot.startTime).toLocaleTimeString("en-US", {
                          hour: "numeric",
                          minute: "2-digit",
                          hour12: true,
                        });
                        const isChosen = selectedSlot?.startTime === slot.startTime;

                        return (
                          <button
                            key={slot.startTime}
                            onClick={() => setSelectedSlot(slot)}
                            className={`p-3 rounded-xl text-xs font-mono transition-all duration-300 border text-center cursor-pointer ${
                              isChosen
                                ? "bg-gradient-to-r from-teal-500 to-emerald-500 text-teal-950 font-bold border-teal-400"
                                : "border-teal-500/15 bg-teal-950/20 text-teal-200 hover:bg-teal-950/40 hover:border-teal-400/30"
                            }`}
                          >
                            {timeStr}
                          </button>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            </LiquidCard>

            {/* Step 2: Guest Details & Confirmation Form */}
            {selectedSlot && (
              <LiquidCard className="p-8">
                <span className="text-xs font-mono uppercase tracking-widest text-teal-400">
                  STEP 2: YOUR DETAILS & CONFIRMATION
                </span>

                {errorMsg && (
                  <div className="mt-4 flex items-center gap-3 rounded-xl border border-red-500/20 bg-red-500/10 p-4 text-xs text-red-200">
                    <AlertCircle className="h-4 w-4 shrink-0 text-red-400" />
                    <span>{errorMsg}</span>
                  </div>
                )}

                <form onSubmit={handleBooking} className="mt-6 space-y-4">
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div>
                      <label className="block text-xs font-mono uppercase text-teal-200/70 mb-1">
                        Your Full Name
                      </label>
                      <div className="relative">
                        <User className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-teal-400/40" />
                        <input
                          type="text"
                          required
                          value={guestName}
                          onChange={(e) => setGuestName(e.target.value)}
                          placeholder="Jane Doe"
                          className="liquid-glass-input w-full pl-11 pr-4 py-3 text-sm focus:outline-none"
                        />
                      </div>
                    </div>

                    <div>
                      <label className="block text-xs font-mono uppercase text-teal-200/70 mb-1">
                        Your Email (for invite & receipt)
                      </label>
                      <div className="relative">
                        <Mail className="absolute left-4 top-1/2 -translate-y-1/2 h-4 w-4 text-teal-400/40" />
                        <input
                          type="email"
                          required
                          value={guestEmail}
                          onChange={(e) => setGuestEmail(e.target.value)}
                          placeholder="jane@example.com"
                          className="liquid-glass-input w-full pl-11 pr-4 py-3 text-sm focus:outline-none"
                        />
                      </div>
                    </div>
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase text-teal-200/70 mb-1">
                      Notes or Agenda (Optional)
                    </label>
                    <textarea
                      rows={3}
                      value={notes}
                      onChange={(e) => setNotes(e.target.value)}
                      placeholder="Please share anything that will help prepare for our meeting..."
                      className="liquid-glass-input w-full px-4 py-3 text-sm focus:outline-none"
                    />
                  </div>

                  {/* Summary Bar */}
                  <div className="pt-4 p-4 rounded-2xl border border-teal-500/20 bg-teal-950/20 flex flex-col sm:flex-row sm:items-center justify-between gap-4">
                    <div>
                      <span className="text-[11px] font-mono text-teal-400/70 uppercase">
                        RESERVATION SUMMARY
                      </span>
                      <p className="font-serif text-lg text-[#F0FDFA]">
                        {new Date(selectedSlot.startTime).toLocaleString("en-US", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </p>
                    </div>

                    <div className="flex items-center gap-4">
                      <div className="text-right">
                        <span className="text-[10px] font-mono text-teal-400/70 uppercase">DUE NOW</span>
                        <div className="font-serif text-xl text-teal-300">
                          {formatPrice(meetingType.priceInPaise, meetingType.currency)}
                        </div>
                      </div>

                      <LiquidButton
                        type="submit"
                        size="md"
                        variant="primary"
                        disabled={submitting}
                      >
                        {submitting
                          ? "Processing..."
                          : meetingType.priceInPaise > 0
                          ? "Proceed to Pay →"
                          : "Confirm Appointment →"}
                      </LiquidButton>
                    </div>
                  </div>
                </form>
              </LiquidCard>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}
