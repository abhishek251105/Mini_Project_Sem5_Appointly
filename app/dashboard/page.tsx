"use client";

import { useEffect, useState, useCallback } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { LiquidButton } from "@/components/ui/liquid-button";
import { LiquidCard } from "@/components/ui/liquid-card";
import { formatPrice, formatDuration } from "@/lib/utils";
import {
  Calendar,
  Clock,
  CreditCard,
  Plus,
  Trash2,
  ExternalLink,
  Copy,
  Check,
  LogOut,
  AlertCircle,
  X,
  Edit2,
  ShieldAlert,
  MapPin,
  RefreshCw,
  Users,
} from "lucide-react";

interface UserProfile {
  id: string;
  name: string;
  email: string;
  slug: string;
  timeZone: string;
}

interface MeetingType {
  id: string;
  title: string;
  description?: string | null;
  duration: number;
  location?: string | null;
  priceInPaise: number;
  currency: string;
  isActive: boolean;
}

interface AvailabilityRule {
  id: string;
  dayOfWeek: number;
  startTime: string;
  endTime: string;
}

interface AvailabilityOverride {
  id: string;
  date: string;
  startTime?: string | null;
  endTime?: string | null;
  isBlocked: boolean;
  reason?: string | null;
}

interface Booking {
  id: string;
  guestName: string;
  guestEmail: string;
  startTime: string;
  endTime: string;
  status: "CONFIRMED" | "PENDING_PAYMENT" | "CANCELLED" | "COMPLETED" | "NO_SHOW";
  notes?: string | null;
  meetingType: {
    title: string;
    duration: number;
    location?: string | null;
    priceInPaise: number;
    currency: string;
  };
}

const DAYS = [
  "Sunday",
  "Monday",
  "Tuesday",
  "Wednesday",
  "Thursday",
  "Friday",
  "Saturday",
];

export default function DashboardPage() {
  const router = useRouter();
  const [user, setUser] = useState<UserProfile | null>(null);
  const [activeTab, setActiveTab] = useState<"overview" | "meeting-types" | "availability" | "bookings">("overview");
  const [loading, setLoading] = useState(true);
  const [copied, setCopied] = useState(false);

  // Data states
  const [meetingTypes, setMeetingTypes] = useState<MeetingType[]>([]);
  const [availabilityRules, setAvailabilityRules] = useState<AvailabilityRule[]>([]);
  const [overrides, setOverrides] = useState<AvailabilityOverride[]>([]);
  const [bookings, setBookings] = useState<Booking[]>([]);

  // Modals & form states
  const [showCreateModal, setShowCreateModal] = useState(false);
  const [newTitle, setNewTitle] = useState("");
  const [newDesc, setNewDesc] = useState("");
  const [newDuration, setNewDuration] = useState(30);
  const [newLocation, setNewLocation] = useState("Google Meet");
  const [newPrice, setNewPrice] = useState(0); // in Rupees
  const [isSubmitting, setIsSubmitting] = useState(false);

  // Weekly rule form
  const [newRuleDay, setNewRuleDay] = useState(1);
  const [newRuleStart, setNewRuleStart] = useState("09:00");
  const [newRuleEnd, setNewRuleEnd] = useState("17:00");

  // Override form
  const [overrideDate, setOverrideDate] = useState("");
  const [overrideBlocked, setOverrideBlocked] = useState(true);
  const [overrideStart, setOverrideStart] = useState("09:00");
  const [overrideEnd, setOverrideEnd] = useState("17:00");
  const [overrideReason, setOverrideReason] = useState("");

  // Reschedule state
  const [rescheduleBookingId, setRescheduleBookingId] = useState<string | null>(null);
  const [rescheduleDate, setRescheduleDate] = useState("");
  const [rescheduleTime, setRescheduleTime] = useState("");

  // Action status message
  const [notification, setNotification] = useState<{ type: "success" | "error"; text: string } | null>(null);

  const showToast = (text: string, type: "success" | "error" = "success") => {
    setNotification({ text, type });
    setTimeout(() => setNotification(null), 4000);
  };

  // Fetch initial profile
  const fetchAllData = useCallback(async () => {
    try {
      const authRes = await fetch("/api/auth/me");
      if (!authRes.ok) {
        router.push("/login");
        return;
      }
      const authData = await authRes.json();
      if (!authData.success || !authData.user) {
        router.push("/login");
        return;
      }
      setUser(authData.user);

      // Fetch meeting types
      const mtRes = await fetch("/api/meeting_type");
      if (mtRes.ok) {
        const mtData = await mtRes.json();
        setMeetingTypes(mtData.meetingTypes || []);
      }

      // Fetch availability
      const avRes = await fetch("/api/availability");
      if (avRes.ok) {
        const avData = await avRes.json();
        setAvailabilityRules(avData.availability || []);
      }

      // Fetch overrides
      const ovRes = await fetch("/api/availability_override");
      if (ovRes.ok) {
        const ovData = await ovRes.json();
        setOverrides(ovData.overrides || []);
      }

      // Fetch bookings
      const bkRes = await fetch("/api/bookings");
      if (bkRes.ok) {
        const bkData = await bkRes.json();
        setBookings(bkData.bookings || []);
      }
    } catch {
      showToast("Error loading dashboard data", "error");
    } finally {
      setLoading(false);
    }
  }, [router]);

  useEffect(() => {
    fetchAllData();
  }, [fetchAllData]);

  // Copy public link
  const copyPublicLink = () => {
    if (!user) return;
    const url = `${window.location.origin}/${user.slug}`;
    navigator.clipboard.writeText(url);
    setCopied(true);
    showToast("Booking link copied to clipboard!");
    setTimeout(() => setCopied(false), 2000);
  };

  // Logout handler
  const handleLogout = async () => {
    await fetch("/api/auth/logout", { method: "POST" });
    router.push("/");
  };

  // Create meeting type
  const handleCreateMeetingType = async (e: React.FormEvent) => {
    e.preventDefault();
    setIsSubmitting(true);
    try {
      const res = await fetch("/api/meeting_type", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          title: newTitle,
          description: newDesc || undefined,
          duration: Number(newDuration),
          location: newLocation || undefined,
          priceInPaise: Math.round(Number(newPrice) * 100),
        }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast("Meeting session created!");
        setShowCreateModal(false);
        setNewTitle("");
        setNewDesc("");
        setNewDuration(30);
        setNewPrice(0);
        fetchAllData();
      } else {
        showToast(data.message || "Failed to create meeting type", "error");
      }
    } catch {
      showToast("Network error creating meeting type", "error");
    } finally {
      setIsSubmitting(false);
    }
  };

  // Toggle or deactivate meeting type
  const handleToggleMeetingType = async (id: string, currentStatus: boolean) => {
    try {
      const res = await fetch(`/api/meeting_type/${id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ isActive: !currentStatus }),
      });
      if (res.ok) {
        showToast(`Session ${!currentStatus ? "activated" : "deactivated"}`);
        fetchAllData();
      }
    } catch {
      showToast("Failed to update session status", "error");
    }
  };

  // Add Availability Rule
  const handleAddRule = async (e: React.FormEvent) => {
    e.preventDefault();
    try {
      const res = await fetch("/api/availability", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          dayOfWeek: Number(newRuleDay),
          startTime: newRuleStart,
          endTime: newRuleEnd,
        }),
      });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast("Availability rule added!");
        fetchAllData();
      } else {
        showToast(data.message || "Failed to add availability", "error");
      }
    } catch {
      showToast("Failed to add availability", "error");
    }
  };

  // Delete Availability Rule
  const handleDeleteRule = async (id: string) => {
    try {
      const res = await fetch(`/api/availability/${id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("Rule removed");
        fetchAllData();
      }
    } catch {
      showToast("Failed to remove rule", "error");
    }
  };

  // Add Override
  const handleAddOverride = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!overrideDate) return;
    try {
      const payload: Record<string, unknown> = {
        date: overrideDate,
        isBlocked: overrideBlocked,
        reason: overrideReason || undefined,
      };
      if (!overrideBlocked) {
        payload.startTime = overrideStart;
        payload.endTime = overrideEnd;
      }

      const res = await fetch("/api/availability_override", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast("Date override added!");
        setOverrideDate("");
        setOverrideReason("");
        fetchAllData();
      } else {
        showToast(data.message || "Failed to add override", "error");
      }
    } catch {
      showToast("Failed to add override", "error");
    }
  };

  // Delete Override
  const handleDeleteOverride = async (id: string) => {
    try {
      const res = await fetch(`/api/availability_override/${id}`, { method: "DELETE" });
      if (res.ok) {
        showToast("Override removed");
        fetchAllData();
      }
    } catch {
      showToast("Failed to remove override", "error");
    }
  };

  // Cancel Booking
  const handleCancelBooking = async (id: string) => {
    if (!confirm("Are you sure you want to cancel this booking? If this session was paid, a refund will automatically be processed via Razorpay.")) {
      return;
    }

    try {
      const res = await fetch(`/api/bookings/${id}/cancel`, { method: "PATCH" });
      const data = await res.json();
      if (res.ok && data.success) {
        showToast("Booking cancelled successfully (Refund triggered if applicable)");
        fetchAllData();
      } else {
        showToast(data.message || "Failed to cancel booking", "error");
      }
    } catch {
      showToast("Failed to cancel booking", "error");
    }
  };

  // Reschedule Booking
  const handleRescheduleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!rescheduleBookingId || !rescheduleDate || !rescheduleTime) return;

    try {
      const newStartTime = new Date(`${rescheduleDate}T${rescheduleTime}:00`).toISOString();
      const res = await fetch(`/api/bookings/${rescheduleBookingId}/reschedule`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ newStartTime }),
      });

      const data = await res.json();
      if (res.ok && data.success) {
        showToast("Booking rescheduled successfully!");
        setRescheduleBookingId(null);
        setRescheduleDate("");
        setRescheduleTime("");
        fetchAllData();
      } else {
        showToast(data.message || "Rescheduling conflict. Please select another slot.", "error");
      }
    } catch {
      showToast("Failed to reschedule booking", "error");
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#0A1214] flex items-center justify-center">
        <div className="font-serif text-2xl text-teal-200/60 animate-pulse">
          Loading your calendar...
        </div>
      </div>
    );
  }

  const confirmedBookings = bookings.filter((b) => b.status === "CONFIRMED");
  const pendingBookings = bookings.filter((b) => b.status === "PENDING_PAYMENT");

  return (
    <div className="min-h-screen bg-[#0A1214] text-[#F0FDFA] selection:bg-teal-500/30 selection:text-teal-200 pb-24">
      {/* Toast Notification */}
      {notification && (
        <div
          className={`fixed bottom-6 right-6 z-50 rounded-2xl border p-4 text-xs font-mono shadow-2xl backdrop-blur-xl transition-all duration-300 ${
            notification.type === "success"
              ? "border-teal-500/40 bg-teal-950/90 text-teal-200 shadow-[0_0_20px_rgba(45,212,191,0.2)]"
              : "border-red-500/30 bg-red-950/90 text-red-200"
          }`}
        >
          {notification.text}
        </div>
      )}

      {/* Top Header */}
      <header className="sticky top-0 z-40 bg-[#0A1214]/90 backdrop-blur-md border-b border-teal-500/15 px-6 py-4 md:px-12">
        <div className="mx-auto max-w-[1320px] flex items-center justify-between">
          <div className="flex items-center gap-4">
            <Link href="/" className="font-serif text-2xl font-normal text-[#F0FDFA]">
              Appointly<span className="text-teal-400">.</span>
            </Link>
            <span className="text-xs font-mono text-teal-400/50 uppercase tracking-widest pl-3 border-l border-teal-500/20 hidden sm:inline-block">
              Host Workspace
            </span>
          </div>

          <div className="flex items-center gap-3">
            {user && (
              <button
                onClick={copyPublicLink}
                className="liquid-glass px-4 py-2 text-xs flex items-center gap-2 hover:bg-teal-950/40 hover:border-teal-400/30 transition-colors cursor-pointer"
                title="Copy public booking link"
              >
                {copied ? (
                  <Check className="h-3.5 w-3.5 text-teal-400" />
                ) : (
                  <Copy className="h-3.5 w-3.5 text-teal-400/60" />
                )}
                <span className="hidden sm:inline">/{user.slug}</span>
              </button>
            )}

            {user && (
              <Link
                href={`/${user.slug}`}
                target="_blank"
                className="liquid-glass px-3.5 py-2 text-xs flex items-center gap-1.5 hover:bg-teal-950/40 hover:border-teal-400/30 transition-colors"
                title="Preview public booking page"
              >
                <span className="hidden sm:inline">Preview</span>
                <ExternalLink className="h-3.5 w-3.5 text-teal-400/60" />
              </Link>
            )}

            <button
              onClick={handleLogout}
              className="liquid-glass px-3.5 py-2 text-xs flex items-center gap-1.5 hover:bg-red-500/10 hover:text-red-300 transition-colors cursor-pointer"
              title="Sign Out"
            >
              <LogOut className="h-3.5 w-3.5" />
            </button>
          </div>
        </div>
      </header>

      {/* Main Workspace */}
      <main className="mx-auto max-w-[1320px] px-6 md:px-12 pt-10">
        {/* Host Welcome Banner */}
        <div className="flex flex-col md:flex-row md:items-end justify-between pb-8 border-b border-teal-500/15 gap-6">
          <div>
            <span className="text-xs uppercase tracking-widest text-teal-400 font-mono">
              TIMEZONE: {user?.timeZone}
            </span>
            <h1 className="mt-2 font-serif text-4xl sm:text-5xl text-[#F0FDFA] tracking-tight">
              Good day, {user?.name}.
            </h1>
            <p className="mt-1 text-sm text-teal-100/60">
              Manage your availability rules, define session offerings, and orchestrate appointments.
            </p>
          </div>

          {/* Navigation Tabs */}
          <div className="flex items-center gap-2 p-1 rounded-full border border-teal-500/20 bg-[#0E1A1D]">
            {(
              [
                { id: "overview", label: "Overview" },
                { id: "meeting-types", label: "Meeting Types" },
                { id: "availability", label: "Availability" },
                { id: "bookings", label: `Bookings (${confirmedBookings.length})` },
              ] as const
            ).map((tab) => (
              <button
                key={tab.id}
                onClick={() => setActiveTab(tab.id)}
                className={`px-4 py-2 rounded-full text-xs font-medium transition-all duration-300 cursor-pointer ${
                  activeTab === tab.id
                    ? "bg-gradient-to-r from-teal-500 to-emerald-500 text-teal-950 font-semibold"
                    : "text-teal-200/60 hover:text-white"
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>
        </div>

        {/* Tab 1: OVERVIEW */}
        {activeTab === "overview" && (
          <div className="mt-8 space-y-8">
            {/* Quick Metrics */}
            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-6">
              <LiquidCard className="p-6">
                <span className="text-xs font-mono text-teal-400/60 uppercase">Upcoming Meetings</span>
                <div className="mt-2 font-serif text-4xl text-[#F0FDFA]">{confirmedBookings.length}</div>
                <p className="mt-1 text-xs text-teal-100/50">Confirmed on your schedule</p>
              </LiquidCard>

              <LiquidCard className="p-6">
                <span className="text-xs font-mono text-teal-400/60 uppercase">Awaiting Payment</span>
                <div className="mt-2 font-serif text-4xl text-amber-300">{pendingBookings.length}</div>
                <p className="mt-1 text-xs text-teal-100/50">15-min reservation holds</p>
              </LiquidCard>

              <LiquidCard className="p-6">
                <span className="text-xs font-mono text-teal-400/60 uppercase">Session Types</span>
                <div className="mt-2 font-serif text-4xl text-[#F0FDFA]">{meetingTypes.length}</div>
                <p className="mt-1 text-xs text-teal-100/50">
                  {meetingTypes.filter((m) => m.isActive).length} active for booking
                </p>
              </LiquidCard>

              <LiquidCard className="p-6">
                <span className="text-xs font-mono text-teal-400/60 uppercase">Active Overrides</span>
                <div className="mt-2 font-serif text-4xl text-[#F0FDFA]">{overrides.length}</div>
                <p className="mt-1 text-xs text-teal-100/50">Blackouts & custom hours</p>
              </LiquidCard>
            </div>

            {/* Next Scheduled Meeting Banner */}
            {confirmedBookings.length > 0 ? (
              <LiquidCard className="p-8 border-teal-500/25 bg-[#0E1A1D]">
                <div className="flex flex-col md:flex-row items-start md:items-center justify-between gap-6">
                  <div>
                    <span className="text-xs uppercase font-mono tracking-widest text-teal-400 flex items-center gap-2">
                      <span className="h-1.5 w-1.5 rounded-full bg-teal-400 animate-ping" />
                      NEXT APPOINTMENT
                    </span>
                    <h3 className="mt-2 font-serif text-2xl md:text-3xl text-[#F0FDFA]">
                      {confirmedBookings[0].meetingType.title} with {confirmedBookings[0].guestName}
                    </h3>
                    <div className="mt-2 flex flex-wrap items-center gap-4 text-xs text-teal-200/70">
                      <span className="flex items-center gap-1.5">
                        <Clock className="h-3.5 w-3.5 text-teal-400" />
                        {new Date(confirmedBookings[0].startTime).toLocaleString("en-US", {
                          dateStyle: "medium",
                          timeStyle: "short",
                        })}
                      </span>
                      <span>•</span>
                      <span>{confirmedBookings[0].guestEmail}</span>
                      {confirmedBookings[0].meetingType.location && (
                        <>
                          <span>•</span>
                          <span className="flex items-center gap-1">
                            <MapPin className="h-3.5 w-3.5 text-teal-400" />
                            {confirmedBookings[0].meetingType.location}
                          </span>
                        </>
                      )}
                    </div>
                  </div>
                  <LiquidButton
                    size="sm"
                    variant="secondary"
                    onClick={() => setActiveTab("bookings")}
                  >
                    View All Bookings →
                  </LiquidButton>
                </div>
              </LiquidCard>
            ) : (
              <LiquidCard className="p-10 text-center border-dashed border-teal-500/20">
                <p className="font-serif text-2xl text-teal-200/60">No upcoming meetings scheduled yet.</p>
                <p className="mt-2 text-xs text-teal-100/40 max-w-sm mx-auto">
                  Share your public booking link to allow clients, peers, or guests to reserve time with you.
                </p>
                <div className="mt-6 flex justify-center">
                  <LiquidButton size="sm" variant="primary" onClick={copyPublicLink}>
                    <Copy className="h-3.5 w-3.5 mr-1" />
                    Copy Shareable Link
                  </LiquidButton>
                </div>
              </LiquidCard>
            )}
          </div>
        )}

        {/* Tab 2: MEETING TYPES */}
        {activeTab === "meeting-types" && (
          <div className="mt-8 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-serif text-3xl text-[#F0FDFA]">Meeting Offerings</h2>
                <p className="text-xs text-teal-100/50">
                  Define durations, pricing (Free or INR), and locations for your session tiers.
                </p>
              </div>
              <LiquidButton
                size="sm"
                variant="primary"
                onClick={() => setShowCreateModal(true)}
              >
                <Plus className="h-4 w-4 mr-1" />
                New Meeting Type
              </LiquidButton>
            </div>

            {meetingTypes.length === 0 ? (
              <LiquidCard className="p-12 text-center border-dashed border-teal-500/20">
                <p className="font-serif text-2xl text-teal-200/60">No meeting types configured.</p>
                <p className="mt-1 text-xs text-teal-100/40">
                  Create your first offering (e.g. &ldquo;30-Min Strategy Call&rdquo; or &ldquo;1-Hour Mentorship&rdquo;).
                </p>
                <div className="mt-6">
                  <LiquidButton size="sm" variant="primary" onClick={() => setShowCreateModal(true)}>
                    <Plus className="h-4 w-4 mr-1" />
                    Create Meeting Type
                  </LiquidButton>
                </div>
              </LiquidCard>
            ) : (
              <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                {meetingTypes.map((mt) => (
                  <LiquidCard key={mt.id} className="relative p-6 flex flex-col justify-between group">
                    <div>
                      <div className="flex items-start justify-between gap-4">
                        <h3 className="font-serif text-2xl text-[#F0FDFA] tracking-tight">{mt.title}</h3>
                        <span
                          className={`text-[10px] font-mono uppercase px-2.5 py-1 rounded-full border ${
                            mt.isActive
                              ? "border-teal-400/40 bg-teal-500/15 text-teal-300"
                              : "border-white/10 bg-white/5 text-white/40"
                          }`}
                        >
                          {mt.isActive ? "Active" : "Inactive"}
                        </span>
                      </div>

                      {mt.description && (
                        <p className="mt-2 text-xs text-teal-100/60 line-clamp-2">{mt.description}</p>
                      )}

                      <div className="mt-6 flex flex-wrap items-center gap-3 text-xs font-mono text-teal-200/60">
                        <span className="flex items-center gap-1">
                          <Clock className="h-3.5 w-3.5 text-teal-400" />
                          {formatDuration(mt.duration)}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1 text-teal-300">
                          <CreditCard className="h-3.5 w-3.5 text-teal-400" />
                          {formatPrice(mt.priceInPaise, mt.currency)}
                        </span>
                        {mt.location && (
                          <>
                            <span>•</span>
                            <span className="flex items-center gap-1">
                              <MapPin className="h-3.5 w-3.5 text-teal-400" />
                              {mt.location}
                            </span>
                          </>
                        )}
                      </div>
                    </div>

                    <div className="mt-6 pt-4 border-t border-teal-500/10 flex items-center justify-between">
                      <button
                        onClick={() => handleToggleMeetingType(mt.id, mt.isActive)}
                        className="text-xs text-teal-200/60 hover:text-white transition-colors cursor-pointer"
                      >
                        {mt.isActive ? "Deactivate" : "Activate"}
                      </button>
                      <Link
                        href={`/${user?.slug}/${mt.id}`}
                        target="_blank"
                        className="text-xs text-teal-400/70 hover:text-teal-300 flex items-center gap-1 transition-colors"
                      >
                        <span>Direct Link</span>
                        <ExternalLink className="h-3 w-3" />
                      </Link>
                    </div>
                  </LiquidCard>
                ))}
              </div>
            )}
          </div>
        )}

        {/* Tab 3: AVAILABILITY & OVERRIDES */}
        {activeTab === "availability" && (
          <div className="mt-8 grid grid-cols-1 lg:grid-cols-12 gap-8">
            {/* Weekly Availability Rules */}
            <div className="lg:col-span-7 space-y-6">
              <div>
                <h2 className="font-serif text-3xl text-[#F0FDFA]">Weekly Working Schedule</h2>
                <p className="text-xs text-teal-100/50">
                  Recurring active hours during which appointments can be booked.
                </p>
              </div>

              {/* Add Rule Form */}
              <LiquidCard className="p-6">
                <h3 className="text-xs uppercase font-mono tracking-widest text-teal-400 mb-4">
                  Add Weekly Window
                </h3>
                <form onSubmit={handleAddRule} className="grid grid-cols-1 sm:grid-cols-4 gap-3 items-end">
                  <div>
                    <label className="block text-[11px] font-mono text-teal-200/60 mb-1">Day of Week</label>
                    <select
                      value={newRuleDay}
                      onChange={(e) => setNewRuleDay(Number(e.target.value))}
                      className="liquid-glass-input w-full px-3 py-2 text-xs bg-[#0E1A1D] text-[#F0FDFA]"
                    >
                      {DAYS.map((day, idx) => (
                        <option key={idx} value={idx} className="bg-[#0E1A1D] text-white">
                          {day}
                        </option>
                      ))}
                    </select>
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-teal-200/60 mb-1">Start Time</label>
                    <input
                      type="time"
                      required
                      value={newRuleStart}
                      onChange={(e) => setNewRuleStart(e.target.value)}
                      className="liquid-glass-input w-full px-3 py-2 text-xs"
                    />
                  </div>

                  <div>
                    <label className="block text-[11px] font-mono text-teal-200/60 mb-1">End Time</label>
                    <input
                      type="time"
                      required
                      value={newRuleEnd}
                      onChange={(e) => setNewRuleEnd(e.target.value)}
                      className="liquid-glass-input w-full px-3 py-2 text-xs"
                    />
                  </div>

                  <div>
                    <LiquidButton type="submit" size="sm" variant="primary" className="w-full">
                      Add Rule
                    </LiquidButton>
                  </div>
                </form>
              </LiquidCard>

              {/* Rules List */}
              <div className="space-y-3">
                {availabilityRules.length === 0 ? (
                  <LiquidCard className="p-8 text-center border-dashed border-teal-500/20">
                    <p className="text-xs text-teal-100/40">No weekly availability rules set yet.</p>
                  </LiquidCard>
                ) : (
                  availabilityRules.map((rule) => (
                    <LiquidCard
                      key={rule.id}
                      className="p-4 flex items-center justify-between border-teal-500/15"
                    >
                      <div className="flex items-center gap-4">
                        <span className="font-serif text-lg text-[#F0FDFA] w-28">
                          {DAYS[rule.dayOfWeek]}
                        </span>
                        <span className="text-xs font-mono text-teal-300">
                          {rule.startTime} — {rule.endTime}
                        </span>
                      </div>
                      <button
                        onClick={() => handleDeleteRule(rule.id)}
                        className="text-white/30 hover:text-red-400 transition-colors p-1"
                        title="Delete Rule"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </LiquidCard>
                  ))
                )}
              </div>
            </div>

            {/* Date Overrides & Blackouts */}
            <div className="lg:col-span-5 space-y-6">
              <div>
                <h2 className="font-serif text-3xl text-[#F0FDFA]">Date Overrides</h2>
                <p className="text-xs text-teal-100/50">
                  Block specific vacation days or define custom availability for a given date.
                </p>
              </div>

              {/* Add Override Form */}
              <LiquidCard className="p-6">
                <h3 className="text-xs uppercase font-mono tracking-widest text-teal-400 mb-4">
                  Add Date Override
                </h3>
                <form onSubmit={handleAddOverride} className="space-y-4">
                  <div>
                    <label className="block text-[11px] font-mono text-teal-200/60 mb-1">Date</label>
                    <input
                      type="date"
                      required
                      value={overrideDate}
                      onChange={(e) => setOverrideDate(e.target.value)}
                      className="liquid-glass-input w-full px-3 py-2 text-xs"
                    />
                  </div>

                  <div className="flex items-center gap-3">
                    <label className="text-xs text-teal-100/70 flex items-center gap-2 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={overrideBlocked}
                        onChange={(e) => setOverrideBlocked(e.target.checked)}
                        className="rounded accent-teal-500"
                      />
                      <span>Block Entire Day (Unavailable)</span>
                    </label>
                  </div>

                  {!overrideBlocked && (
                    <div className="grid grid-cols-2 gap-3">
                      <div>
                        <label className="block text-[11px] font-mono text-teal-200/60 mb-1">Start Time</label>
                        <input
                          type="time"
                          value={overrideStart}
                          onChange={(e) => setOverrideStart(e.target.value)}
                          className="liquid-glass-input w-full px-3 py-2 text-xs"
                        />
                      </div>
                      <div>
                        <label className="block text-[11px] font-mono text-teal-200/60 mb-1">End Time</label>
                        <input
                          type="time"
                          value={overrideEnd}
                          onChange={(e) => setOverrideEnd(e.target.value)}
                          className="liquid-glass-input w-full px-3 py-2 text-xs"
                        />
                      </div>
                    </div>
                  )}

                  <div>
                    <label className="block text-[11px] font-mono text-teal-200/60 mb-1">
                      Reason (Optional)
                    </label>
                    <input
                      type="text"
                      value={overrideReason}
                      onChange={(e) => setOverrideReason(e.target.value)}
                      placeholder="Doctor visit / Holiday / Custom hours"
                      className="liquid-glass-input w-full px-3 py-2 text-xs"
                    />
                  </div>

                  <LiquidButton type="submit" size="sm" variant="primary" className="w-full">
                    Save Override
                  </LiquidButton>
                </form>
              </LiquidCard>

              {/* Overrides List */}
              <div className="space-y-3">
                {overrides.length === 0 ? (
                  <LiquidCard className="p-8 text-center border-dashed border-teal-500/20">
                    <p className="text-xs text-teal-100/40">No date overrides recorded.</p>
                  </LiquidCard>
                ) : (
                  overrides.map((ov) => (
                    <LiquidCard
                      key={ov.id}
                      className="p-4 flex items-center justify-between border-teal-500/15"
                    >
                      <div>
                        <div className="flex items-center gap-2">
                          <span className="font-serif text-base text-[#F0FDFA]">
                            {new Date(ov.date).toLocaleDateString("en-US", {
                              month: "short",
                              day: "numeric",
                              year: "numeric",
                            })}
                          </span>
                          <span
                            className={`text-[9px] font-mono px-2 py-0.5 rounded-full ${
                              ov.isBlocked
                                ? "bg-red-500/15 text-red-300 border border-red-500/30"
                                : "bg-teal-500/15 text-teal-300 border border-teal-500/30"
                            }`}
                          >
                            {ov.isBlocked ? "BLOCKED" : "CUSTOM HOURS"}
                          </span>
                        </div>
                        {ov.reason && (
                          <p className="mt-1 text-xs text-teal-100/50">{ov.reason}</p>
                        )}
                        {!ov.isBlocked && ov.startTime && ov.endTime && (
                          <p className="mt-1 text-xs font-mono text-teal-300">
                            {ov.startTime} — {ov.endTime}
                          </p>
                        )}
                      </div>
                      <button
                        onClick={() => handleDeleteOverride(ov.id)}
                        className="text-white/30 hover:text-red-400 transition-colors p-1"
                        title="Delete Override"
                      >
                        <Trash2 className="h-4 w-4" />
                      </button>
                    </LiquidCard>
                  ))
                )}
              </div>
            </div>
          </div>
        )}

        {/* Tab 4: BOOKINGS */}
        {activeTab === "bookings" && (
          <div className="mt-8 space-y-6">
            <div className="flex items-center justify-between">
              <div>
                <h2 className="font-serif text-3xl text-[#F0FDFA]">Appointments & Guest Requests</h2>
                <p className="text-xs text-teal-100/50">
                  Track confirmations, pending holds, and trigger cancellations or reschedules.
                </p>
              </div>
              <button
                onClick={fetchAllData}
                className="liquid-glass p-2 text-teal-400/60 hover:text-teal-300 transition-colors"
                title="Refresh Bookings"
              >
                <RefreshCw className="h-4 w-4" />
              </button>
            </div>

            {bookings.length === 0 ? (
              <LiquidCard className="p-12 text-center border-dashed border-teal-500/20">
                <p className="font-serif text-2xl text-teal-200/60">No bookings recorded yet.</p>
                <p className="mt-1 text-xs text-teal-100/40">
                  When guests book sessions through your public link, they will appear here.
                </p>
              </LiquidCard>
            ) : (
              <div className="space-y-4">
                {bookings.map((b) => (
                  <LiquidCard key={b.id} className="p-6">
                    <div className="flex flex-col md:flex-row md:items-center justify-between gap-6">
                      <div>
                        <div className="flex items-center gap-3">
                          <h3 className="font-serif text-2xl text-[#F0FDFA]">{b.guestName}</h3>
                          <span
                            className={`text-[10px] font-mono uppercase px-2.5 py-0.5 rounded-full border ${
                              b.status === "CONFIRMED"
                                ? "border-teal-400/40 bg-teal-500/15 text-teal-300"
                                : b.status === "PENDING_PAYMENT"
                                ? "border-amber-500/30 bg-amber-500/10 text-amber-300"
                                : "border-red-500/20 bg-red-500/10 text-red-300"
                            }`}
                          >
                            {b.status}
                          </span>
                        </div>

                        <p className="text-xs text-teal-100/60 mt-1">{b.guestEmail}</p>

                        <div className="mt-4 flex flex-wrap items-center gap-4 text-xs font-mono text-teal-200/70">
                          <span className="flex items-center gap-1.5">
                            <Clock className="h-3.5 w-3.5 text-teal-400" />
                            {new Date(b.startTime).toLocaleString("en-US", {
                              dateStyle: "medium",
                              timeStyle: "short",
                            })}
                          </span>
                          <span>•</span>
                          <span>{b.meetingType.title}</span>
                          <span>•</span>
                          <span className="text-teal-300">{formatPrice(b.meetingType.priceInPaise, b.meetingType.currency)}</span>
                        </div>

                        {b.notes && (
                          <p className="mt-3 text-xs text-teal-100/50 italic bg-teal-950/20 p-2.5 rounded-xl border border-teal-500/10">
                            &ldquo;{b.notes}&rdquo;
                          </p>
                        )}
                      </div>

                      {/* Actions */}
                      <div className="flex items-center gap-3 shrink-0">
                        {b.status === "CONFIRMED" && (
                          <button
                            onClick={() => {
                              setRescheduleBookingId(b.id);
                              setRescheduleDate(new Date(b.startTime).toISOString().slice(0, 10));
                            }}
                            className="liquid-glass px-3.5 py-2 text-xs text-teal-200/80 hover:text-white transition-colors cursor-pointer"
                          >
                            Reschedule
                          </button>
                        )}

                        {(b.status === "CONFIRMED" || b.status === "PENDING_PAYMENT") && (
                          <button
                            onClick={() => handleCancelBooking(b.id)}
                            className="liquid-glass px-3.5 py-2 text-xs text-red-300/80 hover:text-red-300 hover:bg-red-500/10 transition-colors cursor-pointer"
                          >
                            Cancel Session
                          </button>
                        )}
                      </div>
                    </div>
                  </LiquidCard>
                ))}
              </div>
            )}
          </div>
        )}
      </main>

      {/* Modal: Create Meeting Type */}
      {showCreateModal && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-6">
          <div className="w-full max-w-lg">
            <LiquidCard className="p-8 border-teal-500/30">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-serif text-3xl text-[#F0FDFA]">New Meeting Offering</h3>
                <button
                  onClick={() => setShowCreateModal(false)}
                  className="text-white/40 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleCreateMeetingType} className="space-y-4">
                <div>
                  <label className="block text-xs font-mono uppercase text-teal-200/70 mb-1">
                    Title
                  </label>
                  <input
                    type="text"
                    required
                    value={newTitle}
                    onChange={(e) => setNewTitle(e.target.value)}
                    placeholder="e.g. 30-Minute Consultation"
                    className="liquid-glass-input w-full px-4 py-2.5 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase text-teal-200/70 mb-1">
                    Description (Optional)
                  </label>
                  <textarea
                    rows={2}
                    value={newDesc}
                    onChange={(e) => setNewDesc(e.target.value)}
                    placeholder="Brief description of what will be covered..."
                    className="liquid-glass-input w-full px-4 py-2.5 text-sm"
                  />
                </div>

                <div className="grid grid-cols-2 gap-4">
                  <div>
                    <label className="block text-xs font-mono uppercase text-teal-200/70 mb-1">
                      Duration (Minutes)
                    </label>
                    <input
                      type="number"
                      required
                      min={5}
                      max={480}
                      value={newDuration}
                      onChange={(e) => setNewDuration(Number(e.target.value))}
                      className="liquid-glass-input w-full px-4 py-2.5 text-sm"
                    />
                  </div>

                  <div>
                    <label className="block text-xs font-mono uppercase text-teal-200/70 mb-1">
                      Price in ₹ INR (0 for Free)
                    </label>
                    <input
                      type="number"
                      required
                      min={0}
                      value={newPrice}
                      onChange={(e) => setNewPrice(Number(e.target.value))}
                      className="liquid-glass-input w-full px-4 py-2.5 text-sm"
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase text-teal-200/70 mb-1">
                    Location / Meeting Link Type
                  </label>
                  <input
                    type="text"
                    value={newLocation}
                    onChange={(e) => setNewLocation(e.target.value)}
                    placeholder="e.g. Google Meet / Zoom / In-person"
                    className="liquid-glass-input w-full px-4 py-2.5 text-sm"
                  />
                </div>

                <div className="pt-4 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setShowCreateModal(false)}
                    className="px-5 py-2.5 text-xs text-teal-200/60 hover:text-white"
                  >
                    Cancel
                  </button>
                  <LiquidButton type="submit" size="md" variant="primary" disabled={isSubmitting}>
                    {isSubmitting ? "Creating..." : "Save Meeting Type"}
                  </LiquidButton>
                </div>
              </form>
            </LiquidCard>
          </div>
        </div>
      )}

      {/* Modal: Reschedule Booking */}
      {rescheduleBookingId && (
        <div className="fixed inset-0 z-50 bg-black/80 backdrop-blur-md flex items-center justify-center p-6">
          <div className="w-full max-w-md">
            <LiquidCard className="p-8 border-teal-500/30">
              <div className="flex items-center justify-between mb-6">
                <h3 className="font-serif text-3xl text-[#F0FDFA]">Reschedule Booking</h3>
                <button
                  onClick={() => setRescheduleBookingId(null)}
                  className="text-white/40 hover:text-white"
                >
                  <X className="h-5 w-5" />
                </button>
              </div>

              <form onSubmit={handleRescheduleSubmit} className="space-y-4">
                <div>
                  <label className="block text-xs font-mono uppercase text-teal-200/70 mb-1">
                    New Date
                  </label>
                  <input
                    type="date"
                    required
                    value={rescheduleDate}
                    onChange={(e) => setRescheduleDate(e.target.value)}
                    className="liquid-glass-input w-full px-4 py-2.5 text-sm"
                  />
                </div>

                <div>
                  <label className="block text-xs font-mono uppercase text-teal-200/70 mb-1">
                    New Start Time
                  </label>
                  <input
                    type="time"
                    required
                    value={rescheduleTime}
                    onChange={(e) => setRescheduleTime(e.target.value)}
                    className="liquid-glass-input w-full px-4 py-2.5 text-sm"
                  />
                </div>

                <div className="pt-4 flex items-center justify-end gap-3">
                  <button
                    type="button"
                    onClick={() => setRescheduleBookingId(null)}
                    className="px-5 py-2.5 text-xs text-teal-200/60 hover:text-white"
                  >
                    Cancel
                  </button>
                  <LiquidButton type="submit" size="md" variant="primary">
                    Confirm Reschedule
                  </LiquidButton>
                </div>
              </form>
            </LiquidCard>
          </div>
        </div>
      )}
    </div>
  );
}
