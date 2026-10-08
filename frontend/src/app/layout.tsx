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
    <html lang="en" suppressHydrationWarning>
      <head>
        <script
          dangerouslySetInnerHTML={{
            __html: `
              try {
                var theme = localStorage.getItem('classpulse-theme');
                if (theme === 'dark') {
                  document.documentElement.classList.add('dark');
                } else {
                  document.documentElement.classList.remove('dark');
                }
              } catch (_) {}
            `,
          }}
        />
      </head>
      <body className="antialiased bg-[#f8fafc] text-slate-900 dark:bg-[#060b18] dark:text-slate-100 min-h-screen transition-colors duration-200">
        {children}
      </body>
    </html>
  );
}

