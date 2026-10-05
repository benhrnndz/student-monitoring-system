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
  Sparkles, 
  BookOpen, 
  CheckCircle2, 
  AlertCircle 
} from "lucide-react";
import Link from "next/link";

export default function StudentClassroomPage({ params }: { params: Promise<{ sessionId: string }> }) {
  const resolvedParams = use(params);
  const sessionId = resolvedParams.sessionId;

  // Student identity state (defaults to demo student Alex Chen)
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
      console.log("[Student WS] Connected to session", actualSessionId);
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
      trackerRef.current.start(); // Resets input
    }
  }

  // Status visual styles
  let statusBadgeStyle = "bg-emerald-500/10 text-emerald-400 border-emerald-500/20";
  let statusDot = "bg-emerald-500";
  if (status === "IDLE") {
    statusBadgeStyle = "bg-amber-500/10 text-amber-400 border-amber-500/20";
    statusDot = "bg-amber-500";
  } else if (status === "TAB_AWAY") {
    statusBadgeStyle = "bg-orange-500/10 text-orange-400 border-orange-500/20";
    statusDot = "bg-orange-500";
  } else if (status === "WINDOW_UNFOCUSED") {
    statusBadgeStyle = "bg-rose-500/10 text-rose-400 border-rose-500/20";
    statusDot = "bg-rose-500";
  }

  return (
    <div className="min-h-screen bg-slate-950 text-slate-100 flex flex-col">
      {/* Top Banner: Real-Time Status & Transparency */}
      <header className="border-b border-slate-800 bg-slate-900/80 backdrop-blur px-6 py-3 flex flex-wrap items-center justify-between gap-4">
        <div className="flex items-center gap-3">
          <div className="w-8 h-8 rounded-lg bg-blue-600 flex items-center justify-center font-bold text-white text-sm">
            CS
          </div>
          <div>
            <h1 className="text-sm font-bold text-slate-100">CS101: Live Interactive Classroom</h1>
            <p className="text-xs text-slate-400">
              Student: <span className="text-slate-200 font-medium">{studentName}</span>
            </p>
          </div>
        </div>

        {/* Live Focus State Indicator */}
        <div className="flex items-center gap-4">
          <div className="flex items-center gap-2">
            <span className="text-xs text-slate-400">Your Focus Status:</span>
            <span className={`inline-flex items-center gap-1.5 px-3 py-1 rounded-full text-xs font-semibold border ${statusBadgeStyle}`}>
              <span className={`w-2 h-2 rounded-full ${statusDot} ${status === "ACTIVE" ? "animate-pulse" : ""}`}></span>
              {status}
            </span>
          </div>

          <div className="hidden sm:flex items-center gap-1.5 text-xs text-slate-400 bg-slate-900 px-3 py-1 rounded-lg border border-slate-800">
            <Clock className="w-3.5 h-3.5 text-slate-400" />
            <span>Idle in: <strong className="font-mono text-slate-200">{idleTimeRemaining}</strong></span>
          </div>

          <div className="flex items-center gap-1.5 text-xs text-slate-400">
            <ShieldCheck className={`w-4 h-4 ${isExtensionAttached ? "text-blue-400" : "text-slate-600"}`} />
            <span className="hidden md:inline">{isExtensionAttached ? "Extension Verified" : "Web Only"}</span>
          </div>
        </div>
      </header>

      {/* Instructor Nudge Alert Modal */}
      {nudgeMessage && (
        <div className="fixed inset-0 z-50 bg-black/60 backdrop-blur-sm flex items-center justify-center p-4">
          <div className="bg-slate-900 border border-blue-500/40 rounded-2xl p-6 max-w-md w-full shadow-2xl text-center">
            <div className="w-12 h-12 bg-blue-500/20 text-blue-400 rounded-full flex items-center justify-center mx-auto mb-4">
              <Bell className="w-6 h-6 animate-bounce" />
            </div>
            <h3 className="text-lg font-bold text-white">Focus Check-In</h3>
            <p className="text-sm text-slate-300 mt-2 leading-relaxed">{nudgeMessage}</p>
            <button
              onClick={handleDismissNudge}
              className="mt-6 w-full py-2.5 rounded-xl bg-blue-600 hover:bg-blue-500 text-white font-semibold text-sm transition"
            >
              I am here & attentive!
            </button>
          </div>
        </div>
      )}

      {/* Main Classroom Area */}
      <div className="flex-1 p-6 flex flex-col lg:flex-row gap-6 max-w-7xl mx-auto w-full">
        {/* Left: Interactive Class Lecture Content */}
        <div className="flex-1 flex flex-col gap-4">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 relative overflow-hidden flex-1 flex flex-col justify-between">
            <div>
              <div className="flex items-center justify-between text-xs text-slate-400 pb-4 border-b border-slate-800">
                <span className="flex items-center gap-1.5 font-medium text-slate-300">
                  <BookOpen className="w-4 h-4 text-blue-400" />
                  Lecture Notes & Slides
                </span>
                <span>Session Live</span>
              </div>

              <div className="mt-6 space-y-4">
                <h2 className="text-2xl font-bold text-white tracking-tight">
                  Understanding Real-Time Telemetry & Data Structures
                </h2>
                <p className="text-sm text-slate-300 leading-relaxed">
                  In today&apos;s lecture, we explore how high-throughput WebSocket gateways maintain sub-second state synchronization across hundreds of distributed student clients using Redis and PostgreSQL.
                </p>

                <div className="bg-slate-950 p-4 rounded-xl border border-slate-800/80 font-mono text-xs text-blue-300 leading-relaxed">
                  <code>
                    // Real-Time Event Dispatch Example<br />
                    socket.emit(&quot;telemetry:heartbeat&quot;, &#123;<br />
                    &nbsp;&nbsp;studentId: &quot;{studentId}&quot;,<br />
                    &nbsp;&nbsp;status: &quot;{status}&quot;,<br />
                    &nbsp;&nbsp;cameraOn: {isCameraOn ? "true" : "false"}<br />
                    &#125;);
                  </code>
                </div>

                <div className="p-4 bg-slate-950/60 rounded-xl border border-slate-800 text-xs text-slate-400">
                  <h4 className="font-semibold text-slate-200 mb-1">💡 What is being monitored right now?</h4>
                  <ul className="list-disc list-inside space-y-1 text-slate-400">
                    <li>Mouse movements and keyboard interactions (expires after 5 mins of inactivity).</li>
                    <li>Switching away to another tab for &gt; 5 seconds.</li>
                    <li>Focusing on another application or monitor for &gt; 10 seconds.</li>
                    <li>Whether your camera hardware track is enabled (No face AI or video analysis).</li>
                  </ul>
                </div>
              </div>
            </div>

            {/* Quick Testing Bar */}
            <div className="mt-8 pt-4 border-t border-slate-800 flex flex-wrap items-center justify-between gap-3">
              <span className="text-xs text-slate-400">PoC Test Controls:</span>
              <button
                onClick={handleToggleFastIdle}
                className="px-3 py-1.5 rounded-lg text-xs font-medium bg-slate-800 hover:bg-slate-700 text-amber-300 border border-amber-500/20 transition"
              >
                {isFastIdle ? "🔄 Reset to 5m Normal Idle" : "⚡ Test 10s Fast Idle"}
              </button>
            </div>
          </div>
        </div>

        {/* Right Sidebar: Camera Preview & Identity Switcher */}
        <div className="w-full lg:w-80 flex flex-col gap-4">
          {/* Camera Card */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <div className="flex items-center justify-between text-xs font-semibold uppercase text-slate-400 mb-3">
              <span>Your Webcam</span>
              <span className={isCameraOn ? "text-emerald-400" : "text-slate-500"}>
                {isCameraOn ? "Camera ON" : "Camera OFF"}
              </span>
            </div>

            <div className="aspect-video bg-slate-950 rounded-xl overflow-hidden border border-slate-800 flex items-center justify-center relative">
              <video
                ref={videoRef}
                autoPlay
                playsInline
                muted
                className={`w-full h-full object-cover ${!isCameraOn ? "hidden" : ""}`}
              />
              {!isCameraOn && (
                <div className="text-center p-4">
                  <VideoOff className="w-8 h-8 text-slate-600 mx-auto mb-2" />
                  <p className="text-xs text-slate-500">Camera is currently disabled</p>
                </div>
              )}
            </div>

            <button
              onClick={handleToggleCamera}
              className={`w-full mt-3 py-2 rounded-xl text-xs font-semibold flex items-center justify-center gap-2 transition ${
                isCameraOn
                  ? "bg-rose-500/20 hover:bg-rose-500/30 text-rose-300 border border-rose-500/30"
                  : "bg-blue-600 hover:bg-blue-500 text-white"
              }`}
            >
              {isCameraOn ? <VideoOff className="w-4 h-4" /> : <Video className="w-4 h-4" />}
              {isCameraOn ? "Turn Camera OFF" : "Turn Camera ON"}
            </button>
          </div>

          {/* Switch Student Persona for Multi-Student Testing */}
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-5">
            <h3 className="text-xs font-semibold uppercase text-slate-400 mb-3">Test Multi-Student Persona</h3>
            <p className="text-xs text-slate-400 mb-3">
              Switch persona to test seeing multiple distinct student cards on the Teacher Dashboard:
            </p>
            <div className="space-y-2">
              <button
                onClick={() => {
                  setStudentId("alex-chen-uuid");
                  setStudentName("Alex Chen");
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium border transition ${
                  studentName === "Alex Chen"
                    ? "bg-blue-600/20 border-blue-500/50 text-blue-300"
                    : "bg-slate-800/50 border-slate-800 text-slate-400 hover:bg-slate-800"
                }`}
              >
                Alex Chen (Student 1)
              </button>
              <button
                onClick={() => {
                  setStudentId("beatrice-davis-uuid");
                  setStudentName("Beatrice Davis");
                }}
                className={`w-full text-left px-3 py-2 rounded-lg text-xs font-medium border transition ${
                  studentName === "Beatrice Davis"
                    ? "bg-blue-600/20 border-blue-500/50 text-blue-300"
                    : "bg-slate-800/50 border-slate-800 text-slate-400 hover:bg-slate-800"
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
