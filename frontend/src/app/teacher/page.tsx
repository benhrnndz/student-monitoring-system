"use client";

import React, { useEffect, useState, useRef } from "react";
import { WS_BASE, API_BASE, endSession } from "@/lib/api";
import { 
  Users, 
  Video, 
  VideoOff, 
  AlertTriangle, 
  CheckCircle2, 
  Clock, 
  ShieldCheck, 
  Bell, 
  ExternalLink,
  Search,
  Filter,
  RefreshCw,
  LogOut
} from "lucide-react";
import Link from "next/link";

interface StudentCard {
  studentId: string;
  name: string;
  currentStatus: "ACTIVE" | "IDLE" | "TAB_AWAY" | "WINDOW_UNFOCUSED" | "DISCONNECTED";
  cameraOn: boolean;
  extensionActive: boolean;
  tabAwayCount: number;
  windowBlurCount: number;
  lastActiveAt: number;
  reason?: string;
}

interface EventLog {
  id: string;
  time: string;
  studentName: string;
  text: string;
  type: "status" | "warn" | "info";
}

export default function TeacherDashboardPage() {
  const [sessionId, setSessionId] = useState<string>("");
  const [sessionTitle, setSessionTitle] = useState<string>("CS101: Data Structures & Live Telemetry");
  const [students, setStudents] = useState<Record<string, StudentCard>>({});
  const [logs, setLogs] = useState<EventLog[]>([]);
  const [filter, setFilter] = useState<"all" | "attention" | "camera_off">("all");
  const [search, setSearch] = useState<string>("");
  const [isConnected, setIsConnected] = useState<boolean>(false);
  const [elapsedSeconds, setElapsedSeconds] = useState<number>(0);
  const [nudgeFeedback, setNudgeFeedback] = useState<string | null>(null);

  const socketRef = useRef<WebSocket | null>(null);

  // 1. Fetch live session ID from backend
  useEffect(() => {
    async function loadActiveSession() {
      try {
        const res = await fetch(`${API_BASE}/sessions/active`);
        if (res.ok) {
          const data = await res.json();
          if (data && data.id) {
            setSessionId(data.id);
            setSessionTitle(data.title || "CS101: Live Interactive Classroom");
            return;
          }
        }
      } catch (e) {
        console.warn("Could not load active session, falling back to default:", e);
      }
      // Fallback default session ID
      setSessionId("live-demo-session");
    }
    loadActiveSession();
  }, []);

  // 2. Connect to WebSocket
  useEffect(() => {
    if (!sessionId) return;

    const wsUrl = `${WS_BASE}/${sessionId}?role=teacher&user_name=Prof.%20Sarah%20Jenkins`;
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      setIsConnected(true);
      addLog("System", "Connected to live classroom telemetry feed", "info");
    };

    ws.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.event === "teacher:roster_sync") {
          const studentMap: Record<string, StudentCard> = {};
          data.payload.students.forEach((s: StudentCard) => {
            studentMap[s.studentId] = s;
          });
          setStudents(studentMap);
        } else if (data.event === "teacher:student_updated") {
          const updated = data.payload as StudentCard;
          setStudents((prev) => ({
            ...prev,
            [updated.studentId]: updated,
          }));

          const statusColor = updated.currentStatus === "ACTIVE" ? "info" : "warn";
          addLog(
            updated.name,
            `Status changed to ${updated.currentStatus} ${updated.reason ? `(${updated.reason})` : ""}`,
            statusColor
          );
        }
      } catch (err) {
        console.error("Error parsing WS event", err);
      }
    };

    ws.onclose = () => {
      setIsConnected(false);
      addLog("System", "Disconnected from telemetry feed", "warn");
    };

    return () => {
      ws.close();
    };
  }, [sessionId]);

  // Session elapsed timer
  useEffect(() => {
    const timer = setInterval(() => setElapsedSeconds((s) => s + 1), 1000);
    return () => clearInterval(timer);
  }, []);

  function addLog(studentName: string, text: string, type: "status" | "warn" | "info" = "info") {
    const newLog: EventLog = {
      id: Math.random().toString(),
      time: new Date().toLocaleTimeString(),
      studentName,
      text,
      type,
    };
    setLogs((prev) => [newLog, ...prev.slice(0, 49)]);
  }

  function handlePingStudent(studentId: string, studentName: string) {
    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          event: "teacher:nudge",
          payload: {
            studentId,
            message: `Hi ${studentName}, your instructor noticed you stepped away. Are you still with us?`,
          },
        })
      );
      setNudgeFeedback(`Sent focus ping to ${studentName}`);
      setTimeout(() => setNudgeFeedback(null), 3000);
      addLog("Teacher", `Sent focus ping to ${studentName}`, "info");
    }
  }

  async function handleEndSession() {
    if (!sessionId) return;
    if (confirm("Are you sure you want to conclude this live session and view the attendance report?")) {
      await endSession(sessionId);
      window.location.href = `/report/${sessionId}`;
    }
  }

  // Format elapsed time (hh:mm:ss)
  const formatTime = (sec: number) => {
    const m = Math.floor(sec / 60);
    const s = sec % 60;
    return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
  };

  const studentList = Object.values(students);
  const activeCount = studentList.filter((s) => s.currentStatus === "ACTIVE").length;
  const idleCount = studentList.filter((s) => s.currentStatus === "IDLE").length;
  const awayCount = studentList.filter((s) => s.currentStatus === "TAB_AWAY" || s.currentStatus === "WINDOW_UNFOCUSED").length;
  const cameraOnCount = studentList.filter((s) => s.cameraOn).length;

  const filteredStudents = studentList.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (filter === "attention") return s.currentStatus !== "ACTIVE";
    if (filter === "camera_off") return !s.cameraOn;
    return true;
  });

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Navbar */}
      <header className="border-b border-slate-800 bg-slate-900/60 backdrop-blur px-6 py-4 flex flex-wrap items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-xl font-bold tracking-tight text-white">{sessionTitle}</h1>
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-semibold bg-emerald-500/10 text-emerald-400 border border-emerald-500/20">
              <span className="w-2 h-2 rounded-full bg-emerald-500 animate-pulse"></span>
              LIVE
            </span>
          </div>
          <p className="text-xs text-slate-400 mt-0.5">
            Join Code: <span className="font-mono font-bold text-slate-200">CS101A</span> • Duration: {formatTime(elapsedSeconds)}
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/classroom/${sessionId || "demo"}`}
            target="_blank"
            className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 transition"
          >
            <ExternalLink className="w-4 h-4" />
            Open Student View
          </Link>
          <button
            onClick={handleEndSession}
            className="flex items-center gap-1.5 px-3.5 py-1.5 rounded-lg text-sm font-semibold bg-rose-600 hover:bg-rose-500 text-white transition shadow-sm"
          >
            <LogOut className="w-4 h-4" />
            End Session & View Report
          </button>
        </div>
      </header>

      {/* Nudge Notification Toast */}
      {nudgeFeedback && (
        <div className="fixed top-20 right-6 z-50 bg-blue-600 text-white px-4 py-2.5 rounded-lg shadow-lg text-sm font-medium flex items-center gap-2 animate-bounce">
          <Bell className="w-4 h-4" />
          {nudgeFeedback}
        </div>
      )}

      {/* Main Content Layout */}
      <div className="flex-1 flex flex-col lg:flex-row p-6 gap-6">
        {/* Left & Middle: Stats + Student Cards */}
        <div className="flex-1 flex flex-col gap-6">
          {/* Overview Metrics Cards */}
          <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase">
                <span>Active</span>
                <CheckCircle2 className="w-4 h-4 text-emerald-400" />
              </div>
              <div className="text-2xl font-bold text-emerald-400 mt-2">{activeCount}</div>
              <p className="text-xs text-slate-500 mt-1">Interacting within last 5m</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase">
                <span>Idle</span>
                <Clock className="w-4 h-4 text-amber-400" />
              </div>
              <div className="text-2xl font-bold text-amber-400 mt-2">{idleCount}</div>
              <p className="text-xs text-slate-500 mt-1">No input for &gt; 5 mins</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase">
                <span>Tab / Window Away</span>
                <AlertTriangle className="w-4 h-4 text-rose-400" />
              </div>
              <div className="text-2xl font-bold text-rose-400 mt-2">{awayCount}</div>
              <p className="text-xs text-slate-500 mt-1">Switched tab &gt; 5s or app &gt; 10s</p>
            </div>

            <div className="bg-slate-900 border border-slate-800 rounded-xl p-4">
              <div className="flex items-center justify-between text-slate-400 text-xs font-semibold uppercase">
                <span>Camera ON</span>
                <Video className="w-4 h-4 text-blue-400" />
              </div>
              <div className="text-2xl font-bold text-blue-400 mt-2">{cameraOnCount} <span className="text-sm font-normal text-slate-500">/ {studentList.length}</span></div>
              <p className="text-xs text-slate-500 mt-1">Hardware state (no face AI)</p>
            </div>
          </div>

          {/* Search & Filter Bar */}
          <div className="flex flex-wrap items-center justify-between gap-4 bg-slate-900/40 p-3 rounded-xl border border-slate-800/80">
            <div className="flex items-center gap-2">
              <button
                onClick={() => setFilter("all")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  filter === "all" ? "bg-blue-600 text-white" : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                All Students ({studentList.length})
              </button>
              <button
                onClick={() => setFilter("attention")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  filter === "attention" ? "bg-amber-500/20 text-amber-300 border border-amber-500/30" : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                Needs Attention ({idleCount + awayCount})
              </button>
              <button
                onClick={() => setFilter("camera_off")}
                className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                  filter === "camera_off" ? "bg-slate-700 text-white" : "bg-slate-800 text-slate-400 hover:text-white"
                }`}
              >
                Camera OFF ({studentList.length - cameraOnCount})
              </button>
            </div>

            <div className="relative">
              <Search className="w-4 h-4 text-slate-500 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search student..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-slate-900 border border-slate-800 rounded-lg pl-9 pr-4 py-1.5 text-xs text-slate-200 placeholder-slate-500 focus:outline-none focus:border-blue-500 w-48"
              />
            </div>
          </div>

          {/* Student Grid */}
          {filteredStudents.length === 0 ? (
            <div className="bg-slate-900/20 border border-dashed border-slate-800 rounded-xl p-12 text-center">
              <Users className="w-10 h-10 text-slate-600 mx-auto mb-3" />
              <p className="text-slate-400 text-sm">No students currently in session.</p>
              <p className="text-slate-500 text-xs mt-1">Open the student link in another tab or window to see live telemetry in action!</p>
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filteredStudents.map((student) => {
                const isTabAway = student.currentStatus === "TAB_AWAY";
                const isWindowBlur = student.currentStatus === "WINDOW_UNFOCUSED";
                const isIdle = student.currentStatus === "IDLE";
                const isActive = student.currentStatus === "ACTIVE";

                let badgeBg = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
                let badgeText = "ACTIVE";
                let dotColor = "bg-emerald-500";

                if (isIdle) {
                  badgeBg = "bg-amber-500/10 text-amber-400 border-amber-500/20";
                  badgeText = "IDLE (> 5m)";
                  dotColor = "bg-amber-500";
                } else if (isTabAway) {
                  badgeBg = "bg-orange-500/10 text-orange-400 border-orange-500/20";
                  badgeText = "TAB AWAY (> 5s)";
                  dotColor = "bg-orange-500";
                } else if (isWindowBlur) {
                  badgeBg = "bg-rose-500/10 text-rose-400 border-rose-500/20";
                  badgeText = "OFF-SCREEN (> 10s)";
                  dotColor = "bg-rose-500";
                }

                return (
                  <div
                    key={student.studentId}
                    className={`bg-slate-900 border rounded-xl p-4 flex flex-col justify-between transition-all ${
                      isTabAway || isWindowBlur
                        ? "border-rose-500/40 shadow-lg shadow-rose-950/20"
                        : isIdle
                        ? "border-amber-500/30"
                        : "border-slate-800"
                    }`}
                  >
                    <div>
                      <div className="flex items-center justify-between gap-2">
                        <span className="font-semibold text-slate-100 text-sm">{student.name}</span>
                        <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-xs font-semibold border ${badgeBg}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${dotColor} ${isActive ? "animate-pulse" : ""}`}></span>
                          {badgeText}
                        </span>
                      </div>

                      <div className="mt-3 flex items-center gap-3 text-xs text-slate-400">
                        <span className="flex items-center gap-1">
                          {student.cameraOn ? (
                            <span className="text-emerald-400 flex items-center gap-1">
                              <Video className="w-3.5 h-3.5" /> Cam ON
                            </span>
                          ) : (
                            <span className="text-slate-500 flex items-center gap-1">
                              <VideoOff className="w-3.5 h-3.5" /> Cam OFF
                            </span>
                          )}
                        </span>
                        <span>•</span>
                        <span className="flex items-center gap-1">
                          <ShieldCheck className={`w-3.5 h-3.5 ${student.extensionActive ? "text-blue-400" : "text-slate-600"}`} />
                          {student.extensionActive ? "Ext Verified" : "Web Only"}
                        </span>
                      </div>

                      <div className="mt-2 text-xs text-slate-500 flex items-center justify-between">
                        <span>Tab Away count: <strong className="text-slate-300">{student.tabAwayCount}</strong></span>
                        <span>Blur count: <strong className="text-slate-300">{student.windowBlurCount}</strong></span>
                      </div>
                    </div>

                    <div className="mt-4 pt-3 border-t border-slate-800/80 flex items-center justify-end">
                      <button
                        onClick={() => handlePingStudent(student.studentId, student.name)}
                        className="px-2.5 py-1 text-xs font-medium rounded-md bg-slate-800 hover:bg-slate-700 text-slate-300 flex items-center gap-1.5 transition"
                        title="Send focus reminder to this student"
                      >
                        <Bell className="w-3.5 h-3.5" />
                        Ping Student
                      </button>
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {/* Right Drawer: Live Audit Stream */}
        <div className="w-full lg:w-80 bg-slate-900 border border-slate-800 rounded-xl p-4 flex flex-col h-[650px]">
          <div className="flex items-center justify-between pb-3 border-b border-slate-800">
            <div className="flex items-center gap-2">
              <span className="w-2 h-2 rounded-full bg-blue-500 animate-ping"></span>
              <h2 className="text-xs font-bold uppercase tracking-wider text-slate-300">Live Telemetry Feed</h2>
            </div>
            <span className="text-xs font-mono text-slate-500">{logs.length} events</span>
          </div>

          <div className="flex-1 overflow-y-auto mt-3 space-y-2.5 pr-1 font-mono text-xs">
            {logs.length === 0 ? (
              <p className="text-slate-600 text-center mt-12 text-xs">Waiting for telemetry events...</p>
            ) : (
              logs.map((log) => (
                <div
                  key={log.id}
                  className={`p-2 rounded border text-xs leading-relaxed ${
                    log.type === "warn"
                      ? "bg-rose-950/20 border-rose-900/30 text-rose-300"
                      : log.type === "status"
                      ? "bg-blue-950/20 border-blue-900/30 text-blue-300"
                      : "bg-slate-850 border-slate-800 text-slate-400"
                  }`}
                >
                  <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                    <span className="font-semibold text-slate-300">{log.studentName}</span>
                    <span>{log.time}</span>
                  </div>
                  <div>{log.text}</div>
                </div>
              ))
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
