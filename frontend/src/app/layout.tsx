import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Student Learning Monitoring System",
  description: "Privacy-first, real-time telemetry system for online classrooms",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body className="antialiased bg-slate-950 text-slate-100 min-h-screen">
        {children}
      </body>
    </html>
  );
}
