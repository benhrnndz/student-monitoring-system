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
  LogOut,
  Globe,
  ArrowRight,
  UserCheck
} from "lucide-react";
import Link from "next/link";

interface StudentCard {
  studentId: string;
  name: string;
  currentStatus: "ACTIVE" | "IDLE" | "TAB_AWAY" | "WINDOW_UNFOCUSED" | "DISCONNECTED";
  cameraOn: boolean;
  extensionActive: boolean;
  platform?: string;
  source?: string;
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
  const [sessionTitle, setSessionTitle] = useState<string>("CS101: Live Interactive Classroom");
  const [students, setStudents] = useState<Record<string, StudentCard>>({});
  const [selectedStudentId, setSelectedStudentId] = useState<string | null>(null);
  const [logs, setLogs] = useState<EventLog[]>([]);
  const [filter, setFilter] = useState<"all" | "attention" | "camera_off" | "google_meet">("all");
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
          if (data.payload.students.length > 0 && !selectedStudentId) {
            setSelectedStudentId(data.payload.students[0].studentId);
          }
        } else if (data.event === "teacher:student_updated") {
          const updated = data.payload as StudentCard;
          setStudents((prev) => ({
            ...prev,
            [updated.studentId]: updated,
          }));

          const statusColor = updated.currentStatus === "ACTIVE" ? "info" : "warn";
          addLog(
            updated.name,
            `Status updated to ${updated.currentStatus} ${updated.reason ? `(${updated.reason})` : ""}`,
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
      setNudgeFeedback(`Sent focus check-in to ${studentName}`);
      setTimeout(() => setNudgeFeedback(null), 3000);
      addLog("Teacher", `Sent focus check-in to ${studentName}`, "info");
    }
  }

  function handlePingAllInattentive() {
    const inattentiveCount = idleCount + awayCount;
    if (inattentiveCount === 0) return;

    if (socketRef.current && socketRef.current.readyState === WebSocket.OPEN) {
      socketRef.current.send(
        JSON.stringify({
          event: "teacher:nudge_all",
          payload: {
            message: "Your instructor noticed multiple students stepped away. Please refocus on class!",
          },
        })
      );
      setNudgeFeedback(`Sent focus check-in to all ${inattentiveCount} inattentive students!`);
      setTimeout(() => setNudgeFeedback(null), 3500);
      addLog("Teacher", `Broadcasted focus alert to all ${inattentiveCount} inattentive students`, "warn");
    }
  }

  async function handleEndSession() {
    if (!sessionId) return;
    if (confirm("Are you sure you want to conclude this live session and view the attendance report?")) {
      await endSession(sessionId);
      window.location.href = `/report/${sessionId}`;
    }
  }

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
  const googleMeetCount = studentList.filter((s) => s.platform === "GOOGLE_MEET" || s.source === "GOOGLE_MEET" || (s.reason && s.reason.includes("Google Meet"))).length;

  const filteredStudents = studentList.filter((s) => {
    const matchesSearch = s.name.toLowerCase().includes(search.toLowerCase());
    if (!matchesSearch) return false;
    if (filter === "attention") return s.currentStatus !== "ACTIVE";
    if (filter === "camera_off") return !s.cameraOn;
    if (filter === "google_meet") return s.platform === "GOOGLE_MEET" || s.source === "GOOGLE_MEET" || (s.reason && s.reason.includes("Google Meet"));
    return true;
  });

  const selectedStudent = selectedStudentId && students[selectedStudentId] 
    ? students[selectedStudentId] 
    : filteredStudents.length > 0 ? filteredStudents[0] : null;

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col selection:bg-[#0a152d] selection:text-white">
      {/* Top Navbar: Dark Blue Grounding */}
      <header className="bg-[#0a152d] text-white px-6 py-4 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-20 shadow-sm">
        <div>
          <div className="flex items-center gap-3">
            <h1 className="text-lg font-semibold tracking-tight text-white">{sessionTitle}</h1>
            <span className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full text-xs font-medium bg-emerald-500/20 text-emerald-300 border border-emerald-400/30">
              <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse"></span>
              Live Session
            </span>
          </div>
          <p className="text-xs text-slate-300 mt-1">
            Session Code: <span className="font-mono font-bold text-white">CS101A</span> • Elapsed: <span className="font-mono tabular-nums text-white">{formatTime(elapsedSeconds)}</span>
          </p>
        </div>

        <div className="flex items-center gap-3">
          <Link
            href={`/classroom/${sessionId || "demo"}`}
            target="_blank"
            className="pressable flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-[#132347] hover:bg-[#1c3366] text-white border border-white/10 shadow-sm"
          >
            <ExternalLink className="w-3.5 h-3.5 text-blue-300" />
            <span>Open Student View</span>
          </Link>
          <button
            onClick={handleEndSession}
            className="pressable flex items-center gap-1.5 px-3.5 py-2 rounded-lg text-xs font-semibold bg-rose-600 hover:bg-rose-500 text-white shadow-sm"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>End Session & Report</span>
          </button>
        </div>
      </header>

      {/* Floating Toast Notification */}
      {nudgeFeedback && (
        <div className="fixed top-20 right-6 z-50 bg-[#0a152d] text-white px-4 py-3 rounded-xl shadow-xl text-xs font-medium flex items-center gap-3 border border-white/15 animate-in fade-in slide-in-from-top-2">
          <div className="w-6 h-6 rounded-full bg-blue-500/20 text-blue-300 flex items-center justify-center">
            <Bell className="w-3.5 h-3.5" />
          </div>
          <span>{nudgeFeedback}</span>
        </div>
      )}

      {/* Main Workspace on Crisp White Canvas */}
      <div className="flex-1 p-6 max-w-7xl mx-auto w-full flex flex-col gap-6">
        {/* Metric Summary Strip: Clean White Cards */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
              <span>Active Students</span>
              <CheckCircle2 className="w-3.5 h-3.5 text-emerald-600" />
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums text-[#0a152d] mt-2">{activeCount}</div>
            <p className="text-xs text-slate-500 mt-1">Interacting within last 5m</p>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
              <span>Idle Students</span>
              <Clock className="w-3.5 h-3.5 text-amber-600" />
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums text-amber-700 mt-2">{idleCount}</div>
            <p className="text-xs text-slate-500 mt-1">No input for &gt; 5 mins</p>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
              <span>Tab / Window Away</span>
              <AlertTriangle className="w-3.5 h-3.5 text-rose-600" />
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums text-rose-700 mt-2">{awayCount}</div>
            <p className="text-xs text-slate-500 mt-1">Tab &gt; 5s or window &gt; 10s</p>
          </div>

          <div className="bg-white border border-slate-200/90 rounded-xl p-4 shadow-xs">
            <div className="flex items-center justify-between text-slate-500 text-[11px] font-semibold uppercase tracking-wider">
              <span>Camera Active</span>
              <Video className="w-3.5 h-3.5 text-blue-600" />
            </div>
            <div className="text-2xl font-bold font-mono tabular-nums text-[#0a152d] mt-2">
              {cameraOnCount} <span className="text-xs font-normal text-slate-400">/ {studentList.length}</span>
            </div>
            <p className="text-xs text-slate-500 mt-1">Hardware state (no video stream)</p>
          </div>
        </div>

        {/* Filter and Search Bar */}
        <div className="flex flex-wrap items-center justify-between gap-4 bg-white p-3 rounded-xl border border-slate-200/90 shadow-xs">
          <div className="flex flex-wrap items-center gap-2">
            <button
              onClick={() => setFilter("all")}
              className={`pressable px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                filter === "all" ? "bg-[#0a152d] text-white shadow-xs" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              All Students ({studentList.length})
            </button>
            <button
              onClick={() => setFilter("attention")}
              className={`pressable px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                filter === "attention" ? "bg-amber-600 text-white shadow-xs" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Needs Attention ({idleCount + awayCount})
            </button>
            <button
              onClick={() => setFilter("camera_off")}
              className={`pressable px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                filter === "camera_off" ? "bg-[#0a152d] text-white shadow-xs" : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Camera Off ({studentList.length - cameraOnCount})
            </button>
            <button
              onClick={() => setFilter("google_meet")}
              className={`pressable px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
                filter === "google_meet"
                  ? "bg-emerald-700 text-white shadow-xs"
                  : "bg-slate-100 text-slate-700 hover:bg-slate-200"
              }`}
            >
              Google Meet ({googleMeetCount})
            </button>
          </div>

          <div className="flex items-center gap-3">
            {idleCount + awayCount > 0 && (
              <button
                onClick={handlePingAllInattentive}
                className="pressable flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200 shadow-xs"
                title="Send focus check-in alert to all students who are currently Idle or Away"
              >
                <Bell className="w-3.5 h-3.5 text-amber-600" />
                Ping Inattentive ({idleCount + awayCount})
              </button>
            )}

            <div className="relative">
              <Search className="w-3.5 h-3.5 text-slate-400 absolute left-3 top-2.5" />
              <input
                type="text"
                placeholder="Search student..."
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="bg-slate-50 border border-slate-200 focus:border-[#0a152d] rounded-lg pl-8 pr-3 py-1.5 text-xs text-slate-900 placeholder-slate-400 outline-none w-44"
              />
            </div>
          </div>
        </div>

        {/* Structured Master-Detail View: Table on Left + Inspector on Right */}
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
          {/* Main Column (2/3 width): High-Density Structured Roster Table */}
          <div className="lg:col-span-2 bg-white border border-slate-200/90 rounded-xl overflow-hidden shadow-xs">
            <div className="p-4 border-b border-slate-200 font-semibold text-xs text-[#0a152d] uppercase tracking-wider flex items-center justify-between bg-slate-50/50">
              <span>Interactive Student Roster</span>
              <span className="text-xs font-mono font-normal text-slate-500">
                {filteredStudents.length} {filteredStudents.length === 1 ? "student" : "students"} listed
              </span>
            </div>

            {filteredStudents.length === 0 ? (
              <div className="p-12 text-center">
                <Users className="w-8 h-8 text-slate-400 mx-auto mb-2" />
                <p className="text-sm font-semibold text-slate-700">No students currently match this filter.</p>
                <p className="text-xs text-slate-500 mt-1">Open the student portal in a second tab to connect.</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-left text-xs">
                  <thead className="bg-[#f8fafc] text-slate-600 border-b border-slate-200 text-[11px] font-semibold uppercase tracking-wider">
                    <tr>
                      <th className="py-3 px-4">Student Name</th>
                      <th className="py-3 px-4">Status</th>
                      <th className="py-3 px-4">Platform</th>
                      <th className="py-3 px-4">Camera</th>
                      <th className="py-3 px-4 text-center">Tab Away</th>
                      <th className="py-3 px-4 text-center">Blur</th>
                      <th className="py-3 px-4 text-right">Action</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 text-slate-700">
                    {filteredStudents.map((student) => {
                      const isSelected = selectedStudent?.studentId === student.studentId;
                      const isTabAway = student.currentStatus === "TAB_AWAY";
                      const isWindowBlur = student.currentStatus === "WINDOW_UNFOCUSED";
                      const isIdle = student.currentStatus === "IDLE";
                      const isActive = student.currentStatus === "ACTIVE";

                      let badgeClass = "bg-emerald-50 text-emerald-700 border-emerald-200";
                      let badgeDot = "bg-emerald-500";
                      let badgeText = "Active";

                      if (isIdle) {
                        badgeClass = "bg-amber-50 text-amber-700 border-amber-200";
                        badgeDot = "bg-amber-500";
                        badgeText = "Idle (> 5m)";
                      } else if (isTabAway) {
                        badgeClass = "bg-rose-50 text-rose-700 border-rose-200";
                        badgeDot = "bg-rose-500";
                        badgeText = "Tab Away";
                      } else if (isWindowBlur) {
                        badgeClass = "bg-rose-50 text-rose-700 border-rose-200";
                        badgeDot = "bg-rose-500";
                        badgeText = "Off-Screen";
                      }

                      return (
                        <tr
                          key={student.studentId}
                          onClick={() => setSelectedStudentId(student.studentId)}
                          className={`cursor-pointer transition-colors ${
                            isSelected 
                              ? "bg-blue-50/70 border-l-4 border-l-[#0a152d]" 
                              : "hover:bg-slate-50"
                          }`}
                        >
                          <td className="py-3 px-4 font-semibold text-[#0a152d] flex items-center gap-2">
                            <span>{student.name}</span>
                            {student.extensionActive && (
                              <span title="Extension Verified">
                                <ShieldCheck className="w-3.5 h-3.5 text-blue-600" />
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            <span className={`inline-flex items-center gap-1.5 px-2 py-0.5 rounded-full text-[11px] font-semibold border ${badgeClass}`}>
                              <span className={`w-1.5 h-1.5 rounded-full ${badgeDot} ${isActive ? "animate-pulse" : ""}`}></span>
                              {badgeText}
                            </span>
                          </td>
                          <td className="py-3 px-4">
                            {student.platform === "GOOGLE_MEET" || student.source === "GOOGLE_MEET" || (student.reason && student.reason.includes("Google Meet")) ? (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-emerald-800 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200">
                                <Video className="w-3 h-3 text-emerald-600" /> Google Meet
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-slate-700 bg-slate-100 px-2 py-0.5 rounded-md border border-slate-200">
                                <Globe className="w-3 h-3 text-slate-500" /> Web Portal
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4">
                            {student.cameraOn ? (
                              <span className="text-emerald-700 font-medium flex items-center gap-1">
                                <Video className="w-3.5 h-3.5 text-emerald-600" /> ON
                              </span>
                            ) : (
                              <span className="text-slate-400 flex items-center gap-1">
                                <VideoOff className="w-3.5 h-3.5 text-slate-400" /> OFF
                              </span>
                            )}
                          </td>
                          <td className="py-3 px-4 text-center font-mono tabular-nums font-semibold text-slate-700">
                            {student.tabAwayCount}
                          </td>
                          <td className="py-3 px-4 text-center font-mono tabular-nums font-semibold text-slate-700">
                            {student.windowBlurCount}
                          </td>
                          <td className="py-3 px-4 text-right">
                            <button
                              onClick={(e) => {
                                e.stopPropagation();
                                handlePingStudent(student.studentId, student.name);
                              }}
                              className="pressable-sm px-2.5 py-1 text-xs font-semibold rounded-lg bg-[#0a152d] hover:bg-[#132347] text-white shadow-xs inline-flex items-center gap-1"
                            >
                              <Bell className="w-3 h-3" />
                              Ping
                            </button>
                          </td>
                        </tr>
                      );
                    })}
                  </tbody>
                </table>
              </div>
            )}
          </div>

          {/* Right Column: Student Detail Inspector & Telemetry Feed */}
          <div className="space-y-6">
            {/* Student Profile Detail Card */}
            <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs space-y-4">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-500">Student Inspector</span>
                <span className="text-xs font-semibold text-blue-600 bg-blue-50 px-2 py-0.5 rounded border border-blue-200">Active Profile</span>
              </div>

              {selectedStudent ? (
                <div className="space-y-4">
                  <div>
                    <h2 className="text-lg font-bold text-[#0a152d]">{selectedStudent.name}</h2>
                    <p className="text-xs text-slate-500 font-mono">ID: {selectedStudent.studentId}</p>
                  </div>

                  <div className="grid grid-cols-2 gap-2.5 text-xs">
                    <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg">
                      <span className="text-[10px] uppercase font-semibold text-slate-500 block">Current Focus</span>
                      <strong className="text-slate-900 mt-0.5 block">{selectedStudent.currentStatus}</strong>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg">
                      <span className="text-[10px] uppercase font-semibold text-slate-500 block">Platform</span>
                      <strong className="text-slate-900 mt-0.5 block">
                        {selectedStudent.platform === "GOOGLE_MEET" ? "Google Meet" : "Web Portal"}
                      </strong>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg">
                      <span className="text-[10px] uppercase font-semibold text-slate-500 block">Camera Hardware</span>
                      <strong className="text-slate-900 mt-0.5 block">
                        {selectedStudent.cameraOn ? "Enabled 🟢" : "Disabled ⚪"}
                      </strong>
                    </div>
                    <div className="bg-slate-50 border border-slate-200 p-2.5 rounded-lg">
                      <span className="text-[10px] uppercase font-semibold text-slate-500 block">Tab Switches</span>
                      <strong className="text-slate-900 mt-0.5 block font-mono tabular-nums">
                        {selectedStudent.tabAwayCount} times
                      </strong>
                    </div>
                  </div>

                  {selectedStudent.reason && (
                    <div className="p-2.5 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-800">
                      <strong>Last Trigger:</strong> {selectedStudent.reason}
                    </div>
                  )}

                  <button
                    onClick={() => handlePingStudent(selectedStudent.studentId, selectedStudent.name)}
                    className="pressable w-full py-2.5 rounded-xl bg-[#0a152d] hover:bg-[#132347] text-white font-semibold text-xs flex items-center justify-center gap-2 shadow-sm"
                  >
                    <Bell className="w-3.5 h-3.5" />
                    <span>Send Focus Check-In Prompt</span>
                  </button>
                </div>
              ) : (
                <div className="py-6 text-center text-xs text-slate-500">
                  Select a student from the roster table to view real-time metrics.
                </div>
              )}
            </div>

            {/* Live Telemetry Stream */}
            <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs flex flex-col h-[320px]">
              <div className="flex items-center justify-between pb-3 border-b border-slate-100">
                <div className="flex items-center gap-2">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-600 animate-pulse"></span>
                  <span className="text-[11px] font-semibold uppercase tracking-wider text-slate-700">Live Telemetry Feed</span>
                </div>
                <span className="text-xs font-mono tabular-nums text-slate-500">{logs.length} events</span>
              </div>

              <div className="flex-1 overflow-y-auto mt-3 space-y-2 pr-1 font-mono text-xs">
                {logs.length === 0 ? (
                  <p className="text-slate-400 text-center mt-8 text-xs font-sans">Awaiting telemetry activity...</p>
                ) : (
                  logs.map((log) => (
                    <div
                      key={log.id}
                      className={`p-2.5 rounded-lg border text-xs leading-relaxed ${
                        log.type === "warn"
                          ? "bg-rose-50 border-rose-200 text-rose-800"
                          : log.type === "status"
                          ? "bg-blue-50 border-blue-200 text-blue-800"
                          : "bg-slate-50 border-slate-200 text-slate-700"
                      }`}
                    >
                      <div className="flex items-center justify-between text-[10px] text-slate-500 mb-1">
                        <strong className="text-slate-900">{log.studentName}</strong>
                        <span className="tabular-nums">{log.time}</span>
                      </div>
                      <div>{log.text}</div>
                    </div>
                  ))
                )}
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
