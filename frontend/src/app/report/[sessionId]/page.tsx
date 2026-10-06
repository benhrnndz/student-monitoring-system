"use client";

import React, { useEffect, useState, use } from "react";
import { getSessionReport, SessionReport, downloadReportFile } from "@/lib/api";
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
      <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col items-center justify-center gap-3">
        <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
        <p className="text-slate-400 text-sm">Generating session attendance report...</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
        <p className="text-rose-400 font-semibold">Session report not found.</p>
        <Link href="/teacher" className="text-blue-400 text-sm mt-4 inline-block hover:underline">
          &larr; Return to Teacher Dashboard
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
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 max-w-6xl mx-auto flex flex-col gap-6">
      {/* Toast Notification */}
      {toastMessage && (
        <div className="fixed top-6 right-6 z-50 bg-emerald-600 text-white px-4 py-2.5 rounded-xl shadow-xl text-sm font-medium flex items-center gap-2 border border-emerald-500/40 animate-fade-in">
          <Check className="w-4 h-4" />
          {toastMessage}
        </div>
      )}

      {/* Top Header & Actions */}
      <div className="flex flex-wrap items-center justify-between gap-4">
        <Link
          href="/teacher"
          className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Live Dashboard
        </Link>

        {/* Export Buttons */}
        <div className="flex items-center gap-2.5">
          <button
            onClick={() => handleExport("csv")}
            disabled={downloadingFormat !== null}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-slate-900 hover:bg-slate-800 text-slate-200 border border-slate-700/80 transition shadow-sm disabled:opacity-50"
            title="Download CSV for Excel, Google Sheets, or LMS import"
          >
            {downloadingFormat === "csv" ? (
              <Loader2 className="w-4 h-4 animate-spin text-blue-400" />
            ) : (
              <FileText className="w-4 h-4 text-blue-400" />
            )}
            <span>Export CSV</span>
          </button>

          <button
            onClick={() => handleExport("excel")}
            disabled={downloadingFormat !== null}
            className="flex items-center gap-2 px-3.5 py-2 rounded-xl text-xs font-semibold bg-emerald-950/40 hover:bg-emerald-900/60 text-emerald-300 border border-emerald-600/40 transition shadow-sm disabled:opacity-50"
            title="Download formatted Microsoft Excel (.xlsx) spreadsheet with styled tables"
          >
            {downloadingFormat === "excel" ? (
              <Loader2 className="w-4 h-4 animate-spin text-emerald-400" />
            ) : (
              <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
            )}
            <span>Export Excel (.xlsx)</span>
          </button>
        </div>
      </div>

      {/* Session Title & Metadata Hero Card */}
      <div className="bg-slate-900/90 border border-slate-800 rounded-2xl p-6 shadow-sm">
        <div className="flex flex-wrap items-start justify-between gap-6">
          <div>
            <div className="flex items-center gap-2">
              <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
                {report.status === "completed" ? "Completed Session" : "Live Session Snapshot"}
              </span>
              <span className="text-xs text-slate-500 font-mono">ID: {report.sessionId}</span>
            </div>
            <h1 className="text-2xl font-bold text-white mt-2 tracking-tight">{report.title}</h1>
            <p className="text-xs text-slate-400 mt-1">
              Started: {report.startTime ? new Date(report.startTime).toLocaleString() : "N/A"}
              {report.endTime && ` • Ended: ${new Date(report.endTime).toLocaleString()}`}
            </p>
          </div>

          {/* Quick Metrics Grid */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4 w-full lg:w-auto">
            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl px-4 py-3 min-w-[120px]">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Students</div>
              <div className="text-2xl font-bold text-white mt-1">{report.totalStudents}</div>
            </div>

            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl px-4 py-3 min-w-[120px]">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Avg Engagement</div>
              <div className="text-2xl font-bold text-emerald-400 mt-1">{avgEngagement}%</div>
            </div>

            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl px-4 py-3 min-w-[120px]">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">High Focus (≥80%)</div>
              <div className="text-2xl font-bold text-blue-400 mt-1">{highEngagementCount}</div>
            </div>

            <div className="bg-slate-950/60 border border-slate-800/80 rounded-xl px-4 py-3 min-w-[120px]">
              <div className="text-[11px] font-semibold text-slate-400 uppercase tracking-wider">Review (&lt;80%)</div>
              <div className="text-2xl font-bold text-amber-400 mt-1">{reviewCount}</div>
            </div>
          </div>
        </div>
      </div>

      {/* Table Filter & Search Controls */}
      <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/50 p-3.5 rounded-2xl border border-slate-800/80">
        <div className="flex items-center gap-2">
          <button
            onClick={() => setFilter("all")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              filter === "all" ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            All Students ({report.attendances.length})
          </button>
          <button
            onClick={() => setFilter("high")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              filter === "high"
                ? "bg-emerald-600 text-white"
                : "bg-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            High Focus ({highEngagementCount})
          </button>
          <button
            onClick={() => setFilter("review")}
            className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
              filter === "review"
                ? "bg-amber-600 text-white"
                : "bg-slate-800 text-slate-400 hover:text-white"
            }`}
          >
            Needs Review ({reviewCount})
          </button>
        </div>

        <div className="relative min-w-[240px]">
          <Search className="w-4 h-4 text-slate-400 absolute left-3 top-1/2 -translate-y-1/2" />
          <input
            type="text"
            placeholder="Search student by name..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full bg-slate-950 border border-slate-800 rounded-lg pl-9 pr-3 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 transition"
          />
        </div>
      </div>

      {/* Attendance & Engagement Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden shadow-sm">
        <div className="p-4 border-b border-slate-800 font-semibold text-sm text-slate-200 flex items-center justify-between">
          <span>Student Attendance & Engagement Breakdown</span>
          <span className="text-xs font-normal text-slate-400">
            Showing {filteredAttendances.length} of {report.attendances.length}
          </span>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/70 text-slate-400 border-b border-slate-800 uppercase tracking-wider">
              <tr>
                <th className="py-3.5 px-4 font-semibold">Student Name</th>
                <th className="py-3.5 px-4 font-semibold">Active Time</th>
                <th className="py-3.5 px-4 font-semibold">Idle Time</th>
                <th className="py-3.5 px-4 font-semibold">Tab Away</th>
                <th className="py-3.5 px-4 font-semibold">Window Away</th>
                <th className="py-3.5 px-4 font-semibold">Camera Duration</th>
                <th className="py-3.5 px-4 font-semibold">Engagement Score</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {filteredAttendances.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-10 text-center text-slate-500">
                    No matching student attendances found.
                  </td>
                </tr>
              ) : (
                filteredAttendances.map((att) => {
                  const score = Math.round(att.engagementScore);
                  const isHigh = score >= 80;
                  const isMid = score >= 50 && score < 80;
                  return (
                    <tr key={att.studentId} className="hover:bg-slate-800/40 transition">
                      <td className="py-3.5 px-4 font-medium text-white flex items-center gap-2">
                        <span>{att.studentName}</span>
                        {att.extensionVerified && (
                          <span title="Extension Verified (Real tab & blur tracking active)">
                            <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                          </span>
                        )}
                      </td>
                      <td className="py-3.5 px-4 text-emerald-400 font-mono font-medium">
                        {formatSeconds(att.totalActiveSeconds)}
                      </td>
                      <td className="py-3.5 px-4 text-amber-400 font-mono">
                        {formatSeconds(att.totalIdleSeconds)}
                      </td>
                      <td className="py-3.5 px-4 text-orange-400 font-mono">
                        {formatSeconds(att.totalTabAwaySeconds)}
                      </td>
                      <td className="py-3.5 px-4 text-rose-400 font-mono">
                        {formatSeconds(att.totalWindowAwaySeconds)}
                      </td>
                      <td className="py-3.5 px-4 text-blue-400 font-mono">
                        {formatSeconds(att.cameraOnSeconds)}
                      </td>
                      <td className="py-3.5 px-4">
                        <span
                          className={`inline-flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-bold ${
                            isHigh
                              ? "bg-emerald-500/15 text-emerald-400 border border-emerald-500/30"
                              : isMid
                              ? "bg-amber-500/15 text-amber-400 border border-amber-500/30"
                              : "bg-rose-500/15 text-rose-400 border border-rose-500/30"
                          }`}
                        >
                          <Award className="w-3.5 h-3.5" />
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
