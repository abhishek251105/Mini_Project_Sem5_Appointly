"use client";

import { useState } from "react";

export default function Home() {
  const [email, setEmail] = useState("");

  return (
    <main className="min-h-screen bg-white text-slate-900">
      <nav className="mx-auto flex max-w-7xl items-center justify-between px-6 py-5">
        <a href="/" className="text-2xl font-bold tracking-tight">
          Appointly<span className="text-violet-600">.</span>
        </a>

        <div className="hidden items-center gap-8 text-sm text-slate-600 md:flex">
          <a href="#features" className="hover:text-violet-600">Features</a>
          <a href="#how-it-works" className="hover:text-violet-600">How it works</a>
        </div>

        <a
          href="#get-started"
          className="rounded-full bg-slate-900 px-5 py-2.5 text-sm font-medium text-white transition hover:bg-violet-700"
        >
          Get started
        </a>
      </nav>

      <section className="mx-auto grid max-w-7xl items-center gap-14 px-6 py-20 md:grid-cols-2 md:py-28">
        <div>
          <div className="mb-6 inline-flex items-center gap-2 rounded-full border border-violet-100 bg-violet-50 px-4 py-2 text-sm text-violet-700">
            <span className="h-2 w-2 rounded-full bg-violet-600" />
            Meetings, without the back-and-forth
          </div>

          <h1 className="max-w-xl text-5xl font-bold leading-tight tracking-tight md:text-7xl">
            Your time.
            <br />
            Your schedule.
            <br />
            <span className="text-violet-600">Your way.</span>
          </h1>

          <p className="mt-6 max-w-lg text-lg leading-8 text-slate-600">
            Stop chasing calendars and coordinating endless messages.
            Share your booking link and let meetings find their time.
          </p>

          <form
            id="get-started"
            onSubmit={(event) => {
              event.preventDefault();
              window.location.href = `/signup?email=${encodeURIComponent(email)}`;
            }}
            className="mt-8 flex max-w-md flex-col gap-3 sm:flex-row"
          >
            <input
              type="email"
              required
              value={email}
              onChange={(event) => setEmail(event.target.value)}
              placeholder="Enter your email address"
              className="min-w-0 flex-1 rounded-full border border-slate-300 px-5 py-3 outline-none transition focus:border-violet-500 focus:ring-2 focus:ring-violet-100"
            />
            <button
              type="submit"
              className="rounded-full bg-violet-600 px-6 py-3 font-medium text-white transition hover:bg-violet-700"
            >
              Get started →
            </button>
          </form>

          <p className="mt-4 text-sm text-slate-500">
            Simple scheduling. Less admin. More time for what matters.
          </p>
        </div>

        <div className="rounded-3xl border border-slate-200 bg-slate-50 p-5 shadow-xl shadow-slate-200/50 md:p-8">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm text-slate-500">YOUR BOOKING PAGE</p>
              <h2 className="mt-1 text-xl font-bold">Let's meet</h2>
            </div>
            <div className="rounded-xl bg-violet-100 p-3 text-xl">📅</div>
          </div>

          <p className="mt-2 text-sm text-slate-600">
            Choose a date and find a time that works for you.
          </p>

          <div className="mt-7 rounded-2xl border border-slate-200 bg-white p-5">
            <div className="flex items-center justify-between">
              <h3 className="font-semibold">October 2026</h3>
              <span className="text-sm text-slate-400">‹ &nbsp; ›</span>
            </div>

            <div className="mt-5 grid grid-cols-7 gap-2 text-center text-xs text-slate-500">
              {["S", "M", "T", "W", "T", "F", "S"].map((day, i) => (
                <div key={i} className="py-2">{day}</div>
              ))}
              {Array.from({ length: 35 }, (_, i) => {
                const day = i - 2;
                const valid = day >= 1 && day <= 31;
                const selected = day === 12;

                return (
                  <div
                    key={i}
                    className={`rounded-lg py-2 ${
                      selected
                        ? "bg-violet-600 font-semibold text-white"
                        : valid
                          ? "text-slate-700"
                          : "text-slate-300"
                    }`}
                  >
                    {valid ? day : ""}
                  </div>
                );
              })}
            </div>

            <div className="mt-6 border-t border-slate-100 pt-5">
              <p className="mb-3 text-sm font-semibold">Available times</p>
              <div className="grid grid-cols-2 gap-3">
                {["10:00 AM", "11:30 AM", "2:00 PM", "3:30 PM"].map((time) => (
                  <button
                    key={time}
                    type="button"
                    className="rounded-xl border border-violet-200 px-3 py-3 text-sm font-medium text-violet-700 transition hover:border-violet-600 hover:bg-violet-50"
                  >
                    {time}
                  </button>
                ))}
              </div>
            </div>
          </div>

          <div className="mt-4 flex items-center gap-3 rounded-xl bg-white p-4">
            <span className="flex h-10 w-10 items-center justify-center rounded-full bg-green-100 text-green-700">✓</span>
            <div>
              <p className="text-sm font-semibold">Scheduling made simple</p>
              <p className="text-xs text-slate-500">A better way to book your time.</p>
            </div>
          </div>
        </div>
      </section>

      <section id="features" className="border-t border-slate-100 bg-slate-50 px-6 py-20">
        <div className="mx-auto max-w-7xl">
          <div className="mx-auto max-w-2xl text-center">
            <p className="text-sm font-semibold uppercase tracking-widest text-violet-600">
              Why Slotly?
            </p>
            <h2 className="mt-3 text-3xl font-bold tracking-tight md:text-4xl">
              Less scheduling. More doing.
            </h2>
            <p className="mt-4 text-slate-600">
              Everything you need to make appointments easier.
            </p>
          </div>

          <div className="mt-12 grid gap-6 md:grid-cols-3">
            {[
              {
                icon: "🔗",
                title: "One simple link",
                description: "Share your personal booking page and let people choose a convenient time.",
              },
              {
                icon: "🛡️",
                title: "Avoid double bookings",
                description: "Build reliable availability checks to keep your schedule conflict-free.",
              },
              {
                icon: "🔔",
                title: "Stay in the loop",
                description: "Keep hosts and guests informed about confirmations and schedule changes.",
              },
            ].map((feature) => (
              <article key={feature.title} className="rounded-2xl border border-slate-200 bg-white p-7">
                <div className="text-3xl">{feature.icon}</div>
                <h3 className="mt-5 text-lg font-bold">{feature.title}</h3>
                <p className="mt-3 leading-7 text-slate-600">{feature.description}</p>
              </article>
            ))}
          </div>
        </div>
      </section>

      <section id="how-it-works" className="px-6 py-20 text-center">
        <h2 className="text-3xl font-bold tracking-tight">Your next meeting starts here.</h2>
        <p className="mx-auto mt-4 max-w-xl text-slate-600">
          Set your availability, share your link, and let clients book a time that works.
        </p>
        <a
          href="#get-started"
          className="mt-8 inline-flex rounded-full bg-violet-600 px-7 py-3 font-medium text-white transition hover:bg-violet-700"
        >
          Get started for free →
        </a>
      </section>

      <footer className="border-t border-slate-200 px-6 py-8 text-center text-sm text-slate-500">
        © 2026 Slotly. Make time for what matters.
      </footer>
    </main>
  );
}