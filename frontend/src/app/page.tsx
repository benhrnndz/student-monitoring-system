import Link from "next/link";
import { ThemeToggle } from "@/components/ThemeToggle";
import { 
  Users, 
  Monitor, 
  ShieldCheck, 
  Video, 
  Clock, 
  AlertTriangle, 
  ArrowRight,
  EyeOff
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#060b18] text-slate-900 dark:text-slate-100 flex flex-col justify-between selection:bg-[#0a152d] dark:selection:bg-blue-600 selection:text-white transition-colors duration-200">
      {/* Top Navbar */}
      <header className="bg-[#0a152d] dark:bg-[#060b18] text-white px-6 py-4 flex items-center justify-between sticky top-0 z-20 shadow-sm border-b border-white/10">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center font-bold text-white text-xs tracking-wider shadow-sm">
            CP
          </div>
          <div className="flex flex-col">
            <span className="font-semibold text-sm tracking-tight text-white">ClassPulse</span>
            <span className="text-[10px] text-slate-300 font-medium tracking-wide uppercase">Learning Telemetry</span>
          </div>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/teacher"
            className="pressable px-4 py-2 rounded-lg text-xs font-semibold bg-white text-[#0a152d] hover:bg-slate-100 shadow-sm"
          >
            Teacher Portal
          </Link>
          <Link
            href="/classroom/demo"
            className="pressable px-4 py-2 rounded-lg text-xs font-semibold bg-[#132347] hover:bg-[#1c3366] text-white border border-white/10"
          >
            Student Portal
          </Link>
          <ThemeToggle variant="header" />
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-5xl mx-auto px-6 py-20 text-center flex-1 flex flex-col justify-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-semibold bg-blue-50 dark:bg-blue-950/60 text-blue-700 dark:text-blue-300 border border-blue-200 dark:border-blue-900/60 mb-6 mx-auto shadow-xs">
          <span>🛡️</span>
          <span>Privacy-Preserving Classroom Observability</span>
        </div>

        <h1 className="text-4xl sm:text-5xl md:text-6xl font-bold tracking-tight text-[#0a152d] dark:text-white max-w-3xl mx-auto leading-[1.12]">
          Non-intrusive focus telemetry for live classrooms
        </h1>

        <p className="mt-5 text-base sm:text-lg text-slate-600 dark:text-slate-400 max-w-2xl mx-auto leading-relaxed">
          Monitor participation, detect multi-tab distraction, and verify Google Meet attendance without biometric facial AI or continuous video recording.
        </p>

        {/* Action Controls */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/teacher"
            className="pressable flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-[#0a152d] dark:bg-blue-600 hover:bg-[#132347] dark:hover:bg-blue-500 text-white font-semibold text-sm shadow-md"
          >
            <Monitor className="w-4 h-4 text-blue-400 dark:text-white" />
            <span>Launch Teacher Dashboard</span>
            <ArrowRight className="w-4 h-4 text-slate-300 dark:text-white" />
          </Link>

          <Link
            href="/classroom/demo"
            className="pressable flex items-center gap-2.5 px-6 py-3.5 rounded-xl bg-white dark:bg-[#0b1328] hover:bg-slate-50 dark:hover:bg-slate-800 text-[#0a152d] dark:text-white border border-slate-200/90 dark:border-slate-800 font-semibold text-sm shadow-sm"
          >
            <Users className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <span>Join as Student (Demo)</span>
          </Link>
        </div>

        {/* Feature Grid: Clean White Cards in Light Mode / Elevated Navy in Dark Mode */}
        <div className="mt-20 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-left">
          <div className="bg-white dark:bg-[#0b1328] border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-xl p-5 shadow-xs transition-all">
            <div className="w-9 h-9 rounded-lg bg-blue-50 dark:bg-blue-950/60 border border-blue-100 dark:border-blue-900/40 flex items-center justify-center text-blue-600 dark:text-blue-400 mb-4">
              <Clock className="w-4 h-4" />
            </div>
            <h2 className="font-semibold text-sm text-[#0a152d] dark:text-white">Inactivity Tracking</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
              Monitors user keyboard, scroll, and mouse actions. Shifts to idle telemetry after 5 minutes of inactivity.
            </p>
          </div>

          <div className="bg-white dark:bg-[#0b1328] border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-xl p-5 shadow-xs transition-all">
            <div className="w-9 h-9 rounded-lg bg-amber-50 dark:bg-amber-950/60 border border-amber-100 dark:border-amber-900/40 flex items-center justify-center text-amber-600 dark:text-amber-400 mb-4">
              <AlertTriangle className="w-4 h-4" />
            </div>
            <h2 className="font-semibold text-sm text-[#0a152d] dark:text-white">5s Tab Grace Period</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
              Uses Page Visibility API to register when students switch tabs for more than 5 seconds.
            </p>
          </div>

          <div className="bg-white dark:bg-[#0b1328] border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-xl p-5 shadow-xs transition-all">
            <div className="w-9 h-9 rounded-lg bg-rose-50 dark:bg-rose-950/60 border border-rose-100 dark:border-rose-900/40 flex items-center justify-center text-rose-600 dark:text-rose-400 mb-4">
              <Monitor className="w-4 h-4" />
            </div>
            <h2 className="font-semibold text-sm text-[#0a152d] dark:text-white">Window Blur Guard</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
              Flags when students minimize or switch focus to external desktop applications for over 10 seconds.
            </p>
          </div>

          <div className="bg-white dark:bg-[#0b1328] border border-slate-200/80 dark:border-slate-800 hover:border-slate-300 dark:hover:border-slate-700 rounded-xl p-5 shadow-xs transition-all">
            <div className="w-9 h-9 rounded-lg bg-emerald-50 dark:bg-emerald-950/60 border border-emerald-100 dark:border-emerald-900/40 flex items-center justify-center text-emerald-600 dark:text-emerald-400 mb-4">
              <EyeOff className="w-4 h-4" />
            </div>
            <h2 className="font-semibold text-sm text-[#0a152d] dark:text-white">Zero Facial AI</h2>
            <p className="text-xs text-slate-500 dark:text-slate-400 mt-2 leading-relaxed">
              Tracks camera hardware active state only. Zero video capture, facial recognition, or recording.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-200 dark:border-slate-800 py-5 px-6 text-center text-xs text-slate-500 dark:text-slate-400 bg-white dark:bg-[#0b1328] flex flex-col sm:flex-row items-center justify-between gap-3 max-w-5xl mx-auto w-full transition-colors">
        <span className="font-medium text-slate-700 dark:text-slate-300">ClassPulse Student Monitoring System</span>
        <span>Supports Light & Dark Modes • Privacy Guaranteed</span>
      </footer>
    </div>
  );
}
