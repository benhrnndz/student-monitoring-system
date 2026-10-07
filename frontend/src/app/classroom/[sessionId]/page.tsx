"use client";

import React, { useEffect, useState, useRef, use } from "react";
import { WS_BASE } from "@/lib/api";
import { StudentTelemetryTracker, StudentStatus } from "@/lib/telemetry";
import { 
  Video, 
  VideoOff, 
  ShieldCheck, 
  Clock, 
  Bell, 
  BookOpen, 
  ExternalLink,
  EyeOff
} from "lucide-react";
import Link from "next/link";

export default function StudentClassroomPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const resolvedParams = use(params);
  const sessionId = resolvedParams.sessionId;

  // Student identity state
  const [studentId, setStudentId] = useState<string>("alex-chen-uuid");
  const [studentName, setStudentName] = useState<string>("Alex Chen");

  // Telemetry status
  const [status, setStatus] = useState<StudentStatus>("ACTIVE");
  const [statusReason, setStatusReason] = useState<string>("Active in classroom");
  const [isCameraOn, setIsCameraOn] = useState<boolean>(false);
  const [isExtensionAttached, setIsExtensionAttached] = useState<boolean>(false);
  const [idleTimeRemaining, setIdleTimeRemaining] = useState<string>("05:00");
  const [isFastIdle, setIsFastIdle] = useState<boolean>(false);

  // Instructor Nudge State
  const [nudgeMessage, setNudgeMessage] = useState<string | null>(null);

  // References
  const trackerRef = useRef<StudentTelemetryTracker | null>(null);
  const socketRef = useRef<WebSocket | null>(null);
  const videoRef = useRef<HTMLVideoElement | null>(null);

  const [actualSessionId, setActualSessionId] = useState<string>(sessionId);
  const [isWsConnected, setIsWsConnected] = useState<boolean>(false);

  // If sessionId is generic "live-demo" or "demo", resolve the actual active session from backend
  useEffect(() => {
    if (sessionId === "live-demo" || sessionId === "demo") {
      fetch(`${WS_BASE.replace('/ws/session', '/api')}/sessions/active`)
        .then((r) => r.json())
        .then((data) => {
          if (data && data.id) {
            setActualSessionId(data.id);
          }
        })
        .catch(() => setActualSessionId("live-demo-session"));
    }
  }, [sessionId]);

  useEffect(() => {
    // 1. Initialize WebSocket Connection
    const wsUrl = `${WS_BASE}/${actualSessionId}?role=student&user_id=${studentId}&user_name=${encodeURIComponent(studentName)}`;
    const ws = new WebSocket(wsUrl);
    socketRef.current = ws;

    ws.onopen = () => {
      setIsWsConnected(true);

      // Send initial heartbeat to register and sync with teacher dashboard
      ws.send(
        JSON.stringify({
          event: "telemetry:heartbeat",
          sessionId: actualSessionId,
          timestamp: Date.now(),
          payload: {
            studentId,
            status: "ACTIVE",
            cameraOn: isCameraOn,
            extensionActive: isExtensionAttached,
          },
        })
      );

      // Broadcast session details to extension for Google Meet cross-tab tracking
      window.postMessage(
        {
          type: "CLASSROOM_SESSION_SYNC",
          sessionId: actualSessionId,
          studentId,
          studentName,
          wsUrl: WS_BASE,
        },
        "*"
      );
    };

    ws.onclose = () => {
      setIsWsConnected(false);
    };

    ws.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        if (msg.event === "student:nudge") {
          setNudgeMessage(msg.payload.message || "Your instructor is checking your focus.");
        }
      } catch (e) {
        console.error("WS error:", e);
      }
    };

    // 2. Initialize Telemetry Tracker
    const tracker = new StudentTelemetryTracker({
      idleTimeoutMs: 300000, // 5 min
      tabGraceMs: 5000,      // 5 sec
      windowGraceMs: 10000,  // 10 sec
      onStatusChange: (newStatus, prevStatus, reason) => {
        setStatus(newStatus);
        setStatusReason(reason);

        // Transmit status change to instructor via WebSocket
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              event: "telemetry:status_change",
              sessionId: actualSessionId,
              timestamp: Date.now(),
              payload: {
                studentId,
                previousStatus: prevStatus,
                newStatus,
                reason,
                gracePeriodSeconds: newStatus === "TAB_AWAY" ? 5 : newStatus === "WINDOW_UNFOCUSED" ? 10 : 0,
                cameraOn: tracker.isCameraOn,
              },
            })
          );
        }
      },
      onCameraChange: (isOn) => {
        setIsCameraOn(isOn);
        if (ws.readyState === WebSocket.OPEN) {
          ws.send(
            JSON.stringify({
              event: "telemetry:camera_toggle",
              sessionId: actualSessionId,
              timestamp: Date.now(),
              payload: {
                studentId,
                cameraOn: isOn,
              },
            })
          );
        }
      },
      onExtensionDetected: () => {
        setIsExtensionAttached(true);
      },
    });

    trackerRef.current = tracker;
    tracker.start();

    // 3. Heartbeat & Countdown timer
    const countdownInterval = setInterval(() => {
      if (!tracker) return;
      const elapsed = Date.now() - tracker.lastInputTimestamp;
      const remaining = Math.max(0, tracker.options.idleTimeoutMs - elapsed);
      const m = Math.floor(remaining / 60000);
      const s = Math.floor((remaining % 60000) / 1000);
      setIdleTimeRemaining(`${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`);
    }, 500);

    return () => {
      tracker.stop();
      ws.close();
      clearInterval(countdownInterval);
    };
  }, [actualSessionId, studentId, studentName]);

  // Camera toggle handler
  async function handleToggleCamera() {
    if (!trackerRef.current) return;

    if (!trackerRef.current.mediaStream) {
      const stream = await trackerRef.current.requestCamera();
      if (stream && videoRef.current) {
        videoRef.current.srcObject = stream;
      }
    } else {
      trackerRef.current.toggleCamera();
    }
  }

  // Fast Idle toggle for quick demonstration
  function handleToggleFastIdle() {
    if (!trackerRef.current) return;
    const fast = !isFastIdle;
    setIsFastIdle(fast);
    trackerRef.current.options.idleTimeoutMs = fast ? 10000 : 300000;
    trackerRef.current._resetIdleTimer();
  }

  // Acknowledge instructor ping
  function handleDismissNudge() {
    setNudgeMessage(null);
    if (trackerRef.current) {
      trackerRef.current.start();
    }
  }

  // Status visual styles
  let statusBadgeStyle = "bg-emerald-50 text-emerald-700 border-emerald-200";
  let statusDot = "bg-emerald-500";
  if (status === "IDLE") {
    statusBadgeStyle = "bg-amber-50 text-amber-800 border-amber-200";
    statusDot = "bg-amber-500";
  } else if (status === "TAB_AWAY") {
    statusBadgeStyle = "bg-rose-50 text-rose-700 border-rose-200";
    statusDot = "bg-rose-500";
  } else if (status === "WINDOW_UNFOCUSED") {
    statusBadgeStyle = "bg-rose-50 text-rose-700 border-rose-200";
    statusDot = "bg-rose-500";
  }

  return (
    <div className="min-h-screen bg-[#f8fafc] text-slate-900 flex flex-col selection:bg-[#0a152d] selection:text-white">
      {/* Top Banner: Dark Blue Grounding */}
      <header className="bg-[#0a152d] text-white px-6 py-3.5 flex flex-wrap items-center justify-between gap-4 sticky top-0 z-20 shadow-sm">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-500 flex items-center justify-center font-bold text-white text-xs tracking-wider shadow-sm">
            CS
          </div>
          <div>
            <h1 className="text-sm font-semibold tracking-tight text-white">CS101: Live Interactive Classroom</h1>
            <p className="text-xs text-slate-300">
              Logged in as: <strong className="text-white">{studentName}</strong>
            </p>
          </div>
        </div>

        {/* Live Focus State Indicator */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-300">Focus State:</span>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${statusBadgeStyle}`}>
              <span className={`w-1.5 h-1.5 rounded-full ${statusDot} ${status === "ACTIVE" ? "animate-pulse" : ""}`}></span>
              {status}
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-300 bg-[#132347] px-3 py-1 rounded-lg border border-white/10">
            <Clock className="w-3.5 h-3.5 text-slate-300" />
            <span>Idle in: <strong className="font-mono tabular-nums text-white">{idleTimeRemaining}</strong></span>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-300">
            <ShieldCheck className={`w-4 h-4 ${isExtensionAttached ? "text-emerald-400" : "text-slate-400"}`} />
            <span className="hidden md:inline">{isExtensionAttached ? "Extension Verified" : "Web Only"}</span>
          </div>
        </div>
      </header>

      {/* Focus Check-In Modal: Pure White Card */}
      {nudgeMessage && (
        <div className="fixed inset-0 z-50 bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white border border-slate-200 rounded-2xl p-6 max-w-md w-full shadow-2xl text-center">
            <div className="w-12 h-12 bg-blue-50 text-blue-600 border border-blue-200 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bell className="w-5 h-5 animate-pulse" />
            </div>
            <h2 className="text-lg font-bold text-[#0a152d]">Focus Check-In</h2>
            <p className="text-sm text-slate-600 mt-2 leading-relaxed">{nudgeMessage}</p>
            <button
              onClick={handleDismissNudge}
              className="pressable mt-6 w-full py-2.5 rounded-xl bg-[#0a152d] hover:bg-[#132347] text-white font-semibold text-sm shadow-sm"
            >
              I am here & attentive!
            </button>
          </div>
        </div>
      )}

      {/* Main Classroom Area */}
      <div className="flex-1 p-6 flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto w-full">
        {/* Left: Lecture Content on Pure White Surface */}
        <div className="flex-1 flex flex-col gap-4">
          <div className="bg-white border border-slate-200/90 rounded-xl p-6 relative overflow-hidden flex-1 flex flex-col justify-between shadow-xs">
            <div>
              <div className="flex items-center justify-between text-xs text-slate-500 pb-4 border-b border-slate-100">
                <span className="flex items-center gap-1.5 font-medium text-slate-700">
                  <BookOpen className="w-4 h-4 text-blue-600" />
                  Lecture Notes & Interactive Material
                </span>
                <span className="font-mono text-emerald-700 font-semibold bg-emerald-50 px-2.5 py-0.5 rounded border border-emerald-200 text-xs">
                  Active Telemetry Feed
                </span>
              </div>

              <div className="mt-6 space-y-4">
                <h2 className="text-2xl font-bold text-[#0a152d] tracking-tight">
                  High-Throughput Telemetry in Distributed Classrooms
                </h2>
                <p className="text-sm text-slate-600 leading-relaxed">
                  WebSocket gateways maintain sub-second state synchronization across hundreds of distributed student clients, propagating tab focus and idle status securely.
                </p>

                <div className="bg-slate-900 p-4 rounded-xl font-mono text-xs text-blue-300 leading-relaxed shadow-xs">
                  <code>
                    // Real-Time Event Dispatch<br />
                    socket.send(JSON.stringify(&#123;<br />
                    &nbsp;&nbsp;event: &quot;telemetry:heartbeat&quot;,<br />
                    &nbsp;&nbsp;studentId: &quot;{studentId}&quot;,<br />
                    &nbsp;&nbsp;status: &quot;{status}&quot;,<br />
                    &nbsp;&nbsp;cameraOn: {isCameraOn ? "true" : "false"}<br />
                    &#125;));
                  </code>
                </div>

                <div className="p-4 bg-slate-50 rounded-xl border border-slate-200 text-xs text-slate-600">
                  <h3 className="font-semibold text-[#0a152d] mb-2">Non-Intrusive Privacy Guarantees</h3>
                  <ul className="list-disc list-inside space-y-1.5 text-slate-600">
                    <li>Mouse movements and keyboard interactions expire after 5 mins of inactivity.</li>
                    <li>Switching away to another tab is flagged after a 5-second grace period.</li>
                    <li>Focusing on another OS window is flagged after a 10-second grace period.</li>
                    <li>Camera hardware state is checked locally without video transmission or facial recognition.</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Quick Testing Controls */}
            <div className="mt-8 pt-4 border-t border-slate-100 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-slate-500">PoC Simulation Controls:</span>
              <button
                onClick={handleToggleFastIdle}
                className="pressable-sm px-3 py-1.5 rounded-lg text-xs font-semibold bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-200"
              >
                {isFastIdle ? "Reset to 5m Normal Idle" : "Trigger 10s Fast Idle"}
              </button>
            </div>
          </div>
        </div>

        {/* Right Sidebar on Pure White Cards */}
        <div className="w-full lg:w-80 flex flex-col gap-4">
          {/* Google Meet Mode Card */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs">
            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">
              <span className="flex items-center gap-1.5">
                <Video className="w-3.5 h-3.5 text-blue-600" />
                Google Meet Mode
              </span>
              <span className="text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded border border-emerald-200 font-mono text-[11px]">Ready</span>
            </div>
            <p className="text-xs text-slate-600 leading-relaxed mb-3">
              Attending lecture in Google Meet? Open your meeting tab and our Companion Extension will report telemetry directly from Meet.
            </p>
            <a
              href="https://meet.google.com"
              target="_blank"
              rel="noopener noreferrer"
              className="pressable w-full flex items-center justify-center gap-2 px-3 py-2.5 rounded-xl text-xs font-semibold bg-[#0a152d] hover:bg-[#132347] text-white shadow-sm"
            >
              <Video className="w-3.5 h-3.5 text-blue-400" />
              <span>Launch Google Meet ↗</span>
            </a>
          </div>

          {/* Camera Card */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs">
            <div className="flex items-center justify-between text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-3">
              <span>Webcam Monitor</span>
              <span className={isCameraOn ? "text-emerald-700 font-semibold" : "text-slate-400"}>
                {isCameraOn ? "Camera ON" : "Camera OFF"}
              </span>
            </div>

            <div className="aspect-video bg-slate-900 rounded-xl overflow-hidden border border-slate-200 flex items-center justify-center relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${!isCameraOn ? "hidden" : ""}`}
              />
              {!isCameraOn && (
                <div className="text-center p-4">
                  <VideoOff className="w-7 h-7 text-slate-500 mx-auto mb-2" />
                  <p className="text-xs text-slate-400">Camera preview disabled</p>
                </div>
              )}
            </div>

            <button
              onClick={handleToggleCamera}
              className={`pressable w-full mt-3 py-2.5 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition ${
                isCameraOn
                  ? "bg-rose-50 hover:bg-rose-100 text-rose-700 border border-rose-200"
                  : "bg-[#0a152d] hover:bg-[#132347] text-white shadow-sm"
              }`}
            >
              {isCameraOn ? <VideoOff className="w-3.5 h-3.5" /> : <Video className="w-3.5 h-3.5" />}
              {isCameraOn ? "Turn Camera OFF" : "Turn Camera ON"}
            </button>
          </div>

          {/* Switch Student Persona for Multi-Student Testing */}
          <div className="bg-white border border-slate-200/90 rounded-xl p-5 shadow-xs">
            <h3 className="text-[11px] font-semibold uppercase tracking-wider text-slate-500 mb-2">Persona Simulation</h3>
            <p className="text-xs text-slate-500 mb-3">
              Switch identity to simulate multiple concurrent students on the Teacher Dashboard:
            </p>
            <div className="space-y-2">
              <button
                onClick={() => {
                  setStudentId("alex-chen-uuid");
                  setStudentName("Alex Chen");
                }}
                className={`pressable w-full text-left px-3 py-2 rounded-lg text-xs font-semibold border transition ${
                  studentName === "Alex Chen"
                    ? "bg-blue-50 border-blue-400 text-blue-900"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                Alex Chen (Student 1)
              </button>
              <button
                onClick={() => {
                  setStudentId("beatrice-davis-uuid");
                  setStudentName("Beatrice Davis");
                }}
                className={`pressable w-full text-left px-3 py-2 rounded-lg text-xs font-semibold border transition ${
                  studentName === "Beatrice Davis"
                    ? "bg-blue-50 border-blue-400 text-blue-900"
                    : "bg-slate-50 border-slate-200 text-slate-600 hover:bg-slate-100"
                }`}
              >
                Beatrice Davis (Student 2)
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
