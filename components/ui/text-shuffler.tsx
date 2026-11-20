"use client";

import { useEffect, useState } from "react";

const TAGLINES = [
  "Appointments refined to pure signal.",
  "Time reclaimed with effortless grace.",
  "Frictionless scheduling. Editorial clarity.",
  "Zero back-and-forth. Pure momentum.",
  "The art of punctuality and flow.",
];

export function HeroTextShuffler() {
  const [index, setIndex] = useState(0);
  const [visible, setVisible] = useState(true);

  useEffect(() => {
    const interval = setInterval(() => {
      setVisible(false);

      setTimeout(() => {
        setIndex((prev) => (prev + 1) % TAGLINES.length);
        setVisible(true);
      }, 700);
    }, 3500);

    return () => clearInterval(interval);
  }, []);

  return (
    <div className="min-h-[4rem] flex items-center">
      <p
        className="font-serif italic text-2xl md:text-3xl lg:text-4xl text-teal-200/80 tracking-tight transition-opacity duration-700 ease-in-out"
        style={{ opacity: visible ? 1 : 0 }}
      >
        &ldquo;{TAGLINES[index]}&rdquo;
      </p>
    </div>
  );
}
