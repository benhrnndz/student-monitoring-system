import Link from "next/link";
import { 
  Users, 
  Monitor, 
  ShieldCheck, 
  Video, 
  Clock, 
  AlertTriangle, 
  Sparkles,
  ArrowRight
} from "lucide-react";

export default function HomePage() {
  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col justify-between">
      {/* Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/50 backdrop-blur px-6 py-4 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white text-sm">
            SM
          </div>
          <span className="font-bold text-base tracking-tight">Student Learning Monitoring System</span>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href="/teacher"
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-blue-600 hover:bg-blue-500 text-white transition"
          >
            Teacher Portal
          </Link>
          <Link
            href="/classroom/live-demo"
            className="px-3.5 py-1.5 rounded-lg text-xs font-semibold bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            Student Portal
          </Link>
        </div>
      </header>

      {/* Hero Section */}
      <main className="max-w-5xl mx-auto px-6 py-16 text-center flex-1 flex flex-col justify-center">
        <div className="inline-flex items-center gap-2 px-3 py-1 rounded-full text-xs font-medium bg-blue-500/10 text-blue-400 border border-blue-500/20 mb-6 mx-auto">
          <Sparkles className="w-3.5 h-3.5" />
          Real-Time Telemetry & Privacy-First Architecture
        </div>

        <h1 className="text-4xl sm:text-5xl font-extrabold tracking-tight text-white max-w-3xl mx-auto leading-tight">
          Enhance Online Learning with <span className="text-transparent bg-clip-text bg-gradient-to-r from-blue-400 to-emerald-400">Non-Intrusive Focus Telemetry</span>
        </h1>

        <p className="mt-4 text-base text-slate-400 max-w-2xl mx-auto leading-relaxed">
          Monitor student active participation, detect multi-tab distractions, and check camera status without biometric surveillance, facial AI, or video streaming.
        </p>

        {/* Quick Launch Buttons */}
        <div className="mt-10 flex flex-wrap items-center justify-center gap-4">
          <Link
            href="/teacher"
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition shadow-lg shadow-blue-600/20"
          >
            <Monitor className="w-4 h-4" />
            Launch Teacher Dashboard
            <ArrowRight className="w-4 h-4" />
          </Link>

          <Link
            href="/classroom/live-demo"
            className="flex items-center gap-2 px-6 py-3 rounded-xl bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700 font-semibold text-sm transition"
          >
            <Users className="w-4 h-4" />
            Join as Student (Alex Chen)
          </Link>
        </div>

        {/* Feature Cards Grid */}
        <div className="mt-16 grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4 text-left">
          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="w-9 h-9 rounded-lg bg-emerald-500/10 border border-emerald-500/20 flex items-center justify-center text-emerald-400 mb-3">
              <Clock className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-sm text-slate-200">5-Minute Inactivity</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Monitors mouse movements, scrolling, and keyboard actions. Transitions to 🟡 Idle after 5 minutes.
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="w-9 h-9 rounded-lg bg-orange-500/10 border border-orange-500/20 flex items-center justify-center text-orange-400 mb-3">
              <AlertTriangle className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-sm text-slate-200">5s Tab Grace Period</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Page Visibility API flags when students switch tabs for more than 5 seconds.
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="w-9 h-9 rounded-lg bg-rose-500/10 border border-rose-500/20 flex items-center justify-center text-rose-400 mb-3">
              <Monitor className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-sm text-slate-200">10s Window Blur</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Detects when students click onto external apps or secondary screens for over 10 seconds.
            </p>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-xl p-5">
            <div className="w-9 h-9 rounded-lg bg-blue-500/10 border border-blue-500/20 flex items-center justify-center text-blue-400 mb-3">
              <Video className="w-5 h-5" />
            </div>
            <h3 className="font-semibold text-sm text-slate-200">Zero Face Biometrics</h3>
            <p className="text-xs text-slate-400 mt-1 leading-relaxed">
              Monitors camera hardware live/enabled state only. Zero facial AI, no video storage, 100% private.
            </p>
          </div>
        </div>
      </main>

      {/* Footer */}
      <footer className="border-t border-slate-800/80 py-4 text-center text-xs text-slate-500">
        Student Learning Monitoring System • Phase 4 MVP Full-Stack Implementation
      </footer>
    </div>
  );
}
