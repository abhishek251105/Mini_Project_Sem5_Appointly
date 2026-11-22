import type { Metadata } from "next";
import "./fonts.css";
import "./globals.css";

export const metadata: Metadata = {
  title: "Appointly — Editorial Appointment Scheduling",
  description:
    "A refined editorial appointment platform featuring seafoam accents, seamless payments, and calendar precision.",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en" className="dark h-full bg-[#0A1214] text-[#F0FDFA] antialiased">
      <body className="min-h-full bg-[#0A1214] text-[#F0FDFA] selection:bg-teal-500/30 selection:text-teal-200 flex flex-col font-sans">
        {children}
      </body>
    </html>
  );
}
