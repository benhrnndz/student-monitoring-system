"use client";

import React, { useEffect, useState, use } from "react";
import { getSessionReport, SessionReport, downloadReportFile } from "@/lib/api";
import { ThemeToggle } from "@/components/ThemeToggle";
import {
  CheckCircle2,
  Clock,
  Video,
  ShieldCheck,
  ArrowLeft,
  Award,
  FileSpreadsheet,
  Download,
  Search,
  AlertTriangle,
  FileText,
  Loader2,
  Check,
  Calendar,
} from "lucide-react";
import Link from "next/link";

export default function SessionReportPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const resolvedParams = use(params);
  const sessionId = resolvedParams.sessionId;

  const [report, setReport] = useState<SessionReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);
  const [downloadingFormat, setDownloadingFormat] = useState<"csv" | "excel" | null>(null);
  const [toastMessage, setToastMessage] = useState<string | null>(null);
  const [search, setSearch] = useState<string>("");
  const [filter, setFilter] = useState<"all" | "high" | "review">("all");

  useEffect(() => {
    async function loadReport() {
      try {
        const data = await getSessionReport(sessionId);
        setReport(data);
      } catch (err) {
        console.error("Failed to load report", err);
      } finally {
        setLoading(false);
      }
    }
    loadReport();
  }, [sessionId]);

  const handleExport = async (format: "csv" | "excel") => {
    if (downloadingFormat) return;
    try {
      setDownloadingFormat(format);
      await downloadReportFile(sessionId, format);
      setToastMessage(`Exported ${format.toUpperCase()} report successfully!`);
      setTimeout(() => setToastMessage(null), 4000);
    } catch (err) {
      console.error("Export error:", err);
      setToastMessage(`Failed to export ${format.toUpperCase()}. Please check backend.`);
      setTimeout(() => setToastMessage(null), 4000);
    } finally {
      setDownloadingFormat(null);
    }
  };

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m === 0) return `${s}s`;
    return `${m}m ${s}s`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-[#060b18] text-slate-800 dark:text-slate-200 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-6 h-6 text-blue-600 dark:text-blue-400 animate-spin" />
        <p className="text-slate-500 dark:text-slate-400 text-xs font-medium">Generating session attendance telemetry report...</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-[#f8fafc] dark:bg-[#060b18] text-slate-800 dark:text-slate-200 p-8">
        <p className="text-rose-600 dark:text-rose-400 font-semibold text-sm">Session report not found.</p>
        <Link href="/teacher?tab=history" className="text-blue-600 dark:text-blue-400 text-xs mt-4 inline-block hover:underline">
          &larr; Return to Session Dates Archive
        </Link>
      </div>
    );
  }

  const avgEngagement =
    report.attendances.length > 0
      ? Math.round(
          report.attendances.reduce((acc, curr) => acc + curr.engagementScore, 0) /
            report.attendances.length
        )
      : 100;

  const highEngagementCount = report.attendances.filter((a) => a.engagementScore >= 80).length;
  const reviewCount = report.attendances.filter((a) => a.engagementScore < 80).length;

  const filteredAttendances = report.attendances.filter((att) => {
    const matchesSearch = att.studentName.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (filter === "high") return att.engagementScore >= 80;
    if (filter === "review") return att.engagementScore < 80;
    return true;
  });

  return (
    <div className="min-h-screen bg-[#f8fafc] dark:bg-[#060b18] text-slate-900 dark:text-slate-100 p-6 max-w-6xl mx-auto flex flex-col gap-6 selection:bg-[#0a152d] dark:selection:bg-blue-600 selection:text-white transition-colors duration-200">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-[#0a152d] dark:bg-[#0b1328] text-white px-4 py-3 rounded-xl shadow-xl text-xs font-medium flex items-center gap-2.5 border border-white/10 animate-in fade-in slide-in-from-top-2">
          <div className="w-5 h-5 rounded-full bg-emerald-500/20 text-emerald-300 flex items-center justify-center">
            <Check className="w-3.5 h-3.5" />
          </div>
          <span>{toastMessage}</span>
        </div>
      )}

      {/* Top Navigation & Export Triggers */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <Link
            href="/teacher?tab=history"
            className="pressable flex items-center gap-2 text-xs font-semibold text-slate-700 dark:text-slate-300 hover:text-[#0a152d] dark:hover:text-white transition bg-white dark:bg-[#0b1328] px-3.5 py-2 rounded-xl border border-slate-200 dark:border-slate-800 shadow-2xs"
          >
            <ArrowLeft className="w-4 h-4 text-slate-500 dark:text-slate-400" />
            <span>Back to All Session Dates</span>
          </Link>
          <Link
            href="/teacher"
            className="pressable flex items-center gap-2 text-xs font-semibold text-slate-500 dark:text-slate-400 hover:text-slate-800 dark:hover:text-slate-200 transition"
          >
            Live Dashboard
          </Link>
        </div>

        {/* Export Controls & Theme Toggle */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => handleExport("csv")}
            disabled={downloadingFormat !== null}
            className="pressable flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-white dark:bg-[#0b1328] hover:bg-slate-50 dark:hover:bg-slate-800 text-slate-700 dark:text-slate-300 border border-slate-200 dark:border-slate-800 shadow-xs disabled:opacity-50"
            title="Download CSV for Excel, Google Sheets, or LMS import"
          >
            {downloadingFormat === "csv" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-blue-600 dark:text-blue-400" />
            ) : (
              <FileText className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
            )}
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => handleExport("excel")}
            disabled={downloadingFormat !== null}
            className="pressable flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-[#0a152d] dark:bg-blue-600 hover:bg-[#132347] dark:hover:bg-blue-500 text-white shadow-xs disabled:opacity-50"
            title="Download formatted Microsoft Excel (.xlsx) spreadsheet with styled tables"
          >
            {downloadingFormat === "excel" ? (
              <Loader2 className="w-3.5 h-3.5 animate-spin text-white" />
            ) : (
              <FileSpreadsheet className="w-3.5 h-3.5 text-emerald-400 dark:text-emerald-300" />
            )}
            <span>Export Excel (.xlsx)</span>
          </button>

          {/* Theme Toggle */}
          <ThemeToggle variant="surface" />
        </div>
      </div>

      {/* Hero Session Summary Card: Pure White / Dark Navy with Metrics */}
      <div className="bg-white dark:bg-[#0b1328] border border-slate-200/90 dark:border-slate-800 rounded-2xl p-6 shadow-xs transition-colors">
        {/* Prominent Session Date Header Banner */}
        <div className="flex flex-wrap items-center justify-between gap-4 pb-4 mb-4 border-b border-slate-100 dark:border-slate-800">
          <div className="flex items-center gap-3">
            <div className="w-12 h-12 rounded-xl bg-blue-50 dark:bg-[#091024] border border-blue-200 dark:border-blue-900/60 flex flex-col items-center justify-center shrink-0">
              <span className="text-[10px] font-bold text-blue-700 dark:text-blue-400 uppercase">
                {report.startTime ? new Date(report.startTime).toLocaleString("en-US", { month: "short" }) : "DATE"}
              </span>
              <span className="text-base font-black text-[#0a152d] dark:text-white font-mono leading-none">
                {report.startTime ? new Date(report.startTime).getDate() : "--"}
              </span>
            </div>
            <div>
              <div className="flex items-center gap-2">
                <span className="text-xs font-bold text-[#0a152d] dark:text-white flex items-center gap-1.5">
                  <Calendar className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                  {report.startTime ? new Date(report.startTime).toLocaleDateString("en-US", { weekday: "long", year: "numeric", month: "long", day: "numeric" }) : "Session Date Recorded"}
                </span>
                <span className="text-xs text-slate-300 dark:text-slate-600">•</span>
                <span className="text-xs text-slate-500 dark:text-slate-400 font-mono">
                  {report.startTime ? new Date(report.startTime).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" }) : ""}
                  {report.endTime ? ` – ${new Date(report.endTime).toLocaleTimeString("en-US", { hour: "2-digit", minute: "2-digit" })}` : ""}
                </span>
              </div>
              <p className="text-[11px] text-slate-500 dark:text-slate-400 mt-0.5">
                Classroom: {report.classroomName || "Computer Science 101 - Algorithms"} • Code: <span className="font-mono font-semibold text-slate-700 dark:text-slate-300">{report.joinCode || "CS101A"}</span>
              </p>
            </div>
          </div>

          <span className="px-3 py-1 rounded-full text-xs font-semibold bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border border-emerald-200 dark:border-emerald-800">
            {report.status === "completed" ? "Verified Concluded Session" : "Live Session Snapshot"}
          </span>
        </div>

        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <span className="text-xs text-slate-400 dark:text-slate-500 font-mono">Session ID: {report.sessionId}</span>
            <h1 className="text-2xl font-bold text-[#0a152d] dark:text-white mt-1 tracking-tight">{report.title}</h1>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full lg:w-auto">
            <div className="bg-slate-50 dark:bg-[#0e172e] border border-slate-200/80 dark:border-slate-800 rounded-xl px-4 py-3 min-w-[120px]">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Students</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-[#0a152d] dark:text-white mt-1">{report.totalStudents}</div>
            </div>

            <div className="bg-slate-50 dark:bg-[#0e172e] border border-slate-200/80 dark:border-slate-800 rounded-xl px-4 py-3 min-w-[120px]">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Avg Score</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-emerald-700 dark:text-emerald-400 mt-1">{avgEngagement}%</div>
            </div>

            <div className="bg-slate-50 dark:bg-[#0e172e] border border-slate-200/80 dark:border-slate-800 rounded-xl px-4 py-3 min-w-[120px]">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Focus (≥80%)</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-blue-700 dark:text-blue-400 mt-1">{highEngagementCount}</div>
            </div>

            <div className="bg-slate-50 dark:bg-[#0e172e] border border-slate-200/80 dark:border-slate-800 rounded-xl px-4 py-3 min-w-[120px]">
              <div className="text-[11px] font-semibold text-slate-500 dark:text-slate-400 uppercase tracking-wider">Review (&lt;80%)</div>
              <div className="text-2xl font-bold font-mono tabular-nums text-amber-700 dark:text-amber-400 mt-1">{reviewCount}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Filter and Search Bar */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-white dark:bg-[#0b1328] p-3 rounded-xl border border-slate-200/90 dark:border-slate-800 shadow-xs transition-colors">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`pressable px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              filter === "all" ? "bg-[#0a152d] dark:bg-blue-600 text-white shadow-xs" : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            All Students ({report.attendances.length})
          </button>
          <button
            onClick={() => setFilter("high")}
            className={`pressable px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              filter === "high"
                ? "bg-emerald-700 dark:bg-emerald-600 text-white shadow-xs"
                : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            High Focus ({highEngagementCount})
          </button>
          <button
            onClick={() => setFilter("review")}
            className={`pressable px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              filter === "review"
                ? "bg-amber-600 dark:bg-amber-600 text-white shadow-xs"
                : "bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-300 hover:bg-slate-200 dark:hover:bg-slate-700"
            }`}
          >
            Needs Review ({reviewCount})
          </button>
        </div>

        <div className="relative min-w-[240px]">
          <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search student by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-50 dark:bg-slate-800/60 border border-slate-200 dark:border-slate-700 focus:border-[#0a152d] dark:focus:border-blue-500 rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 dark:text-slate-100 placeholder-slate-400 dark:placeholder-slate-500 outline-none transition"
          />
        </div>
      </div>

      {/* Attendance & Engagement Table */}
      <div className="bg-white dark:bg-[#0b1328] border border-slate-200/90 dark:border-slate-800 rounded-xl overflow-hidden shadow-xs transition-colors">
        <div className="p-4 border-b border-slate-200 dark:border-slate-800 font-semibold text-xs text-[#0a152d] dark:text-slate-200 uppercase tracking-wider flex items-center justify-between bg-slate-50/50 dark:bg-slate-900/60">
          <span>Attendance & Engagement Breakdown</span>
          <span className="text-xs font-mono font-normal text-slate-500 dark:text-slate-400">
            Showing {filteredAttendances.length} of {report.attendances.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-[#f8fafc] dark:bg-[#091024] text-slate-600 dark:text-slate-400 border-b border-slate-200 dark:border-slate-800 text-[11px] font-semibold uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-4">Active Time</th>
                <th className="py-3 px-4">Idle Time</th>
                <th className="py-3 px-4">Tab Away</th>
                <th className="py-3 px-4">Window Blur</th>
                <th className="py-3 px-4">Camera</th>
                <th className="py-3 px-4 text-right">Engagement Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100 dark:divide-slate-800/60 text-slate-700 dark:text-slate-300">
              {filteredAttendances.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500 dark:text-slate-400">
                    No matching student attendances found.
                  </td>
                </tr>
              ) : (
                filteredAttendances.map((att) => {
                  const score = Math.round(att.engagementScore);
                  const isHigh = score >= 80;
                  const isMid = score >= 50 && score < 80;
                  return (
                    <tr key={att.studentId} className="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition">
                      <td className="py-3 px-4 font-semibold text-[#0a152d] dark:text-white flex items-center gap-2">
                        <span>{att.studentName}</span>
                        {att.extensionVerified && (
                          <span title="Extension Verified">
                            <ShieldCheck className="w-3.5 h-3.5 text-blue-600 dark:text-blue-400" />
                          </span>
                        )}
                      </td>
                      <td className="py-3 px-4 text-emerald-700 dark:text-emerald-400 font-mono tabular-nums font-semibold">
                        {formatSeconds(att.totalActiveSeconds)}
                      </td>
                      <td className="py-3 px-4 text-amber-700 dark:text-amber-400 font-mono tabular-nums">
                        {formatSeconds(att.totalIdleSeconds)}
                      </td>
                      <td className="py-3 px-4 text-rose-700 dark:text-rose-400 font-mono tabular-nums">
                        {formatSeconds(att.totalTabAwaySeconds)}
                      </td>
                      <td className="py-3 px-4 text-rose-700 dark:text-rose-400 font-mono tabular-nums">
                        {formatSeconds(att.totalWindowAwaySeconds)}
                      </td>
                      <td className="py-3 px-4 text-slate-600 dark:text-slate-400 font-mono tabular-nums">
                        {formatSeconds(att.cameraOnSeconds)}
                      </td>
                      <td className="py-3 px-4 text-right">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold font-mono tabular-nums border ${
                            isHigh
                              ? "bg-emerald-50 dark:bg-emerald-950/60 text-emerald-800 dark:text-emerald-300 border-emerald-200 dark:border-emerald-800"
                              : isMid
                              ? "bg-amber-50 dark:bg-amber-950/60 text-amber-800 dark:text-amber-300 border-amber-200 dark:border-amber-800"
                              : "bg-rose-50 dark:bg-rose-950/60 text-rose-800 dark:text-rose-300 border-rose-200 dark:border-rose-800"
                          }`}
                        >
                          <Award className="w-3 h-3" />
                          {score}%
                        </span>
                      </td>
                    </tr>
                  );
                })
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
