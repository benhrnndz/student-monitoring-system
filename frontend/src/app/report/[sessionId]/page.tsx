"use client";

import React, { useEffect, useState, use } from "react";
import { getSessionReport, SessionReport } from "@/lib/api";
import { CheckCircle2, Clock, Video, ShieldCheck, ArrowLeft, Award, FileSpreadsheet } from "lucide-react";
import Link from "next/link";

export default function SessionReportPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const resolvedParams = use(params);
  const sessionId = resolvedParams.sessionId;

  const [report, setReport] = useState<SessionReport | null>(null);
  const [loading, setLoading] = useState<boolean>(true);

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

  const formatSeconds = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    if (m === 0) return `${s}s`;
    return `${m}m ${s}s`;
  };

  if (loading) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 flex items-center justify-center">
        <p className="text-slate-400 text-sm">Generating session attendance report...</p>
      </div>
    );
  }

  if (!report) {
    return (
      <div className="min-h-screen bg-slate-950 text-slate-100 p-8">
        <p className="text-rose-400">Session report not found.</p>
        <Link href="/teacher" className="text-blue-400 text-sm mt-4 inline-block">
          &larr; Return to Teacher Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 p-6 max-w-6xl mx-auto">
      <div className="mb-6 flex items-center justify-between">
        <Link
          href="/teacher"
          className="flex items-center gap-2 text-xs font-semibold text-slate-400 hover:text-white transition"
        >
          <ArrowLeft className="w-4 h-4" />
          Back to Live Dashboard
        </Link>
        <button
          onClick={() => alert("CSV Export downloaded.")}
          className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
        >
          <FileSpreadsheet className="w-4 h-4 text-emerald-400" />
          Export CSV
        </button>
      </div>

      <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 mb-6">
        <div className="flex flex-wrap items-center justify-between gap-4">
          <div>
            <span className="px-2.5 py-0.5 rounded-full text-xs font-semibold bg-blue-500/10 text-blue-400 border border-blue-500/20">
              Completed Session
            </span>
            <h1 className="text-2xl font-bold text-white mt-2">{report.title}</h1>
            <p className="text-xs text-slate-400 mt-1">Session ID: {report.sessionId}</p>
          </div>

          <div className="flex gap-6 text-right">
            <div>
              <div className="text-xs text-slate-400">Total Enrolled</div>
              <div className="text-xl font-bold text-white mt-0.5">{report.totalStudents}</div>
            </div>
            <div>
              <div className="text-xs text-slate-400">Average Engagement</div>
              <div className="text-xl font-bold text-emerald-400 mt-0.5">
                {report.attendances.length > 0
                  ? Math.round(
                      report.attendances.reduce((acc, curr) => acc + curr.engagementScore, 0) /
                        report.attendances.length
                    )
                  : 100}
                %
              </div>
            </div>
          </div>
        </div>
      </div>

      {/* Attendance Table */}
      <div className="bg-slate-900 border border-slate-800 rounded-2xl overflow-hidden">
        <div className="p-4 border-b border-slate-800 font-semibold text-sm text-slate-200">
          Student Attendance & Engagement Breakdown
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-left text-xs">
            <thead className="bg-slate-950/50 text-slate-400 border-b border-slate-800 uppercase tracking-wider">
              <tr>
                <th className="py-3 px-4">Student</th>
                <th className="py-3 px-4">Active Time</th>
                <th className="py-3 px-4">Idle Time</th>
                <th className="py-3 px-4">Tab Away</th>
                <th className="py-3 px-4">Window Away</th>
                <th className="py-3 px-4">Camera Duration</th>
                <th className="py-3 px-4">Engagement</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-800/60 text-slate-300">
              {report.attendances.length === 0 ? (
                <tr>
                  <td colSpan={7} className="py-8 text-center text-slate-500">
                    No student attendances logged for this session yet.
                  </td>
                </tr>
              ) : (
                report.attendances.map((att) => (
                  <tr key={att.studentId} className="hover:bg-slate-850/50 transition">
                    <td className="py-3.5 px-4 font-medium text-white flex items-center gap-2">
                      {att.studentName}
                      {att.extensionVerified && (
                        <span title="Extension Verified">
                          <ShieldCheck className="w-3.5 h-3.5 text-blue-400" />
                        </span>
                      )}
                    </td>
                    <td className="py-3.5 px-4 text-emerald-400 font-mono">{formatSeconds(att.totalActiveSeconds)}</td>
                    <td className="py-3.5 px-4 text-amber-400 font-mono">{formatSeconds(att.totalIdleSeconds)}</td>
                    <td className="py-3.5 px-4 text-orange-400 font-mono">{formatSeconds(att.totalTabAwaySeconds)}</td>
                    <td className="py-3.5 px-4 text-rose-400 font-mono">{formatSeconds(att.totalWindowAwaySeconds)}</td>
                    <td className="py-3.5 px-4 text-blue-400 font-mono">{formatSeconds(att.cameraOnSeconds)}</td>
                    <td className="py-3.5 px-4">
                      <span className="inline-flex items-center gap-1 font-bold text-emerald-400">
                        <Award className="w-3.5 h-3.5" />
                        {Math.round(att.engagementScore)}%
                      </span>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
}
