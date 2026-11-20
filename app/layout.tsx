import type { Metadata } from "next";
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
      <head>
        <link rel="preconnect" href="https://fonts.googleapis.com" />
        <link rel="preconnect" href="https://fonts.gstatic.com" crossOrigin="anonymous" />
        <link
          href="https://fonts.googleapis.com/css2?family=Instrument+Serif:ital@0;1&family=Inter:wght@300;400;500;600;700&display=swap"
          rel="stylesheet"
        />
      </head>
      <body className="min-h-full bg-[#0A1214] text-[#F0FDFA] selection:bg-teal-500/30 selection:text-teal-200 flex flex-col">
        {children}
      </body>
    </html>
  );
}
