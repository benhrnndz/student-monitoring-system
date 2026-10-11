export const API_BASE = process.env.NEXT_PUBLIC_API_URL || "http://localhost:8000/api";
export const WS_BASE = process.env.NEXT_PUBLIC_WS_URL || "ws://localhost:8000/ws/session";

export interface SessionHistoryItem {
  id: string;
  classroom_id: string;
  classroom_name: string;
  join_code: string;
  title: string;
  status: "live" | "completed" | "scheduled";
  start_time: string | null;
  end_time: string | null;
  created_at: string | null;
  total_students: number;
  avg_engagement: number;
  duration_seconds: number;
  duration_formatted: string;
}

export interface AttendanceItem {
  studentId: string;
  studentName: string;
  studentEmail?: string;
  firstJoinedAt: string | null;
  lastLeftAt: string | null;
  totalActiveSeconds: number;
  totalIdleSeconds: number;
  totalTabAwaySeconds: number;
  totalWindowAwaySeconds: number;
  cameraOnSeconds: number;
  engagementScore: number;
  extensionVerified: boolean;
}

export interface SessionReport {
  sessionId: string;
  title: string;
  status: string;
  classroomName?: string;
  joinCode?: string;
  startTime: string | null;
  endTime: string | null;
  totalStudents: number;
  attendances: AttendanceItem[];
}

export async function getAllSessions(): Promise<SessionHistoryItem[]> {
  const res = await fetch(`${API_BASE}/sessions/`);
  if (!res.ok) throw new Error("Failed to fetch sessions history");
  return res.json();
}

export async function getActiveSession(): Promise<{
  active: boolean;
  id: string | null;
  title: string | null;
  status: string | null;
  classroom_name: string | null;
  join_code: string | null;
  start_time: string | null;
}> {
  const res = await fetch(`${API_BASE}/sessions/active`);
  if (!res.ok) throw new Error("Failed to fetch active session");
  return res.json();
}

export async function startNewSession(title?: string, classroomId?: string): Promise<{
  id: string;
  title: string;
  status: string;
  classroom_id: string;
  classroom_name: string;
  join_code: string;
  start_time: string;
}> {
  const res = await fetch(`${API_BASE}/sessions/start`, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({ title, classroom_id: classroomId }),
  });
  if (!res.ok) throw new Error("Failed to start new session");
  return res.json();
}

export async function deleteSession(sessionId: string): Promise<void> {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}`, {
    method: "DELETE",
  });
  if (!res.ok) throw new Error("Failed to delete session");
}

export async function endSession(sessionId: string): Promise<any> {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}/end`, {
    method: "POST",
  });
  if (!res.ok) throw new Error("Failed to end session");
  return res.json();
}

export async function getSessionReport(sessionId: string): Promise<SessionReport> {
  const res = await fetch(`${API_BASE}/sessions/${sessionId}/report`);
  if (!res.ok) throw new Error("Failed to fetch report");
  return res.json();
}

export function getExportCsvUrl(sessionId: string): string {
  return `${API_BASE}/sessions/${sessionId}/export/csv`;
}

export function getExportExcelUrl(sessionId: string): string {
  return `${API_BASE}/sessions/${sessionId}/export/excel`;
}

export async function downloadReportFile(sessionId: string, format: "csv" | "excel"): Promise<void> {
  const url = format === "csv" ? getExportCsvUrl(sessionId) : getExportExcelUrl(sessionId);
  const response = await fetch(url);
  if (!response.ok) throw new Error(`Failed to download ${format.toUpperCase()} export`);

  const blob = await response.blob();
  const disposition = response.headers.get("content-disposition");
  let filename = `session_report_${sessionId}.${format === "csv" ? "csv" : "xlsx"}`;
  if (disposition && disposition.includes("filename=")) {
    const match = disposition.match(/filename="?([^"]+)"?/);
    if (match && match[1]) {
      filename = match[1];
    }
  }

  const blobUrl = window.URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = blobUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
  window.URL.revokeObjectURL(blobUrl);
}
