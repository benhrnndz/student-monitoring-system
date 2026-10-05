# Phase 1: Project Scope, Requirements & Telemetry Specification
**Project:** Student Learning Monitoring System  
**Status:** Approved / Finalized  
**Version:** 1.0.0  

---

## 1. Executive Summary & System Objectives

The **Student Learning Monitoring System** is designed to enhance the online learning experience by providing instructors with real-time visibility into student presence, attentiveness, and engagement during live sessions without intrusive or computationally heavy surveillance.

### Core Objectives
1. **Accurate Inactivity Tracking:** Detect whether students are actively interacting with their learning environment or idling.
2. **Multi-Tab & External Browser Detection:** Detect when students navigate away from class material, switch browser tabs, or use external applications.
3. **Camera State Visibility:** Inform instructors whether a student's webcam is turned on or off without recording or processing biometric facial video data.
4. **Privacy-First Architecture:** Ensure zero biometric data collection, low client CPU/battery usage, and total transparency for students.

---

## 2. Architectural Model: Option B (Web App + Companion Browser Extension)

To balance user convenience with accurate browser-level detection, the system operates as a hybrid solution:

```
+-----------------------------------------------------------------------+
| STUDENT WORKSTATION                                                   |
|                                                                       |
|  +---------------------------+        +----------------------------+  |
|  | Classroom Web App         |        | Browser Extension          |  |
|  | (React / Next.js)         |<-------| (Chrome / Edge MV3)        |  |
|  |                           |  Post  |                            |  |
|  | - UI & Classroom Content  |Message/| - chrome.tabs API          |  |
|  | - Mouse/Key Listeners     | Runtime| - chrome.windows API       |  |
|  | - Camera Hardware State   | Port   | - chrome.idle API          |  |
|  +-------------+-------------+        +----------------------------+  |
+----------------|------------------------------------------------------+
                 | Real-Time WebSocket Telemetry
                 v
+-----------------------------------------------------------------------+
| BACKEND SERVICES                                                      |
|                                                                       |
|  +--------------------+    +-------------------+    +--------------+  |
|  | WebSocket Gateway  |<-->| Redis State Cache |<-->| PostgreSQL   |  |
|  | (FastAPI / NestJS) |    | (Active Sessions) |    | (Event Logs) |  |
|  +---------+----------+    +-------------------+    +--------------+  |
+------------|----------------------------------------------------------+
             | Real-Time Alerts & Presence Updates
             v
+-----------------------------------------------------------------------+
| INSTRUCTOR WORKSTATION                                                |
|                                                                       |
|  +-----------------------------------------------------------------+  |
|  | Teacher Live Monitoring Dashboard                               |  |
|  | - Student Grid Cards (Active, Idle, Tab Away, Window Unfocused) |  |
|  | - Camera On/Off Badges                                          |  |
|  | - Live Activity Stream & Post-Session Analytics                 |  |
|  +-----------------------------------------------------------------+  |
+-----------------------------------------------------------------------+
```

### Components
1. **Classroom Web App (Student Client):**
   * Hosts class material, lecture audio/video, or live session interface.
   * Tracks in-page user activity (mouse, keyboard, scroll).
   * Reads hardware media track state (camera enabled/disabled).
   * Aggregates telemetry packets and emits them to the WebSocket server.
2. **Companion Browser Extension (Manifest V3):**
   * Installed once on student browsers (Google Chrome, Microsoft Edge, Brave).
   * Overcomes the browser sandbox by listening to `chrome.tabs` and `chrome.windows` events.
   * Dispatches alerts when students navigate to secondary tabs, open new windows, or change system focus.
   * Communicates directly with the Classroom Web App via `chrome.runtime.sendMessage` and `window.postMessage`.

---

## 3. Telemetry & Monitoring Rules

### Rule 1: Student Activity & Inactivity (5-Minute Threshold)
* **Definition of Active:** The student is physically providing input inside the classroom web application.
* **Monitored Events:** `mousemove`, `mousedown`, `keydown`, `scroll`, and `touchstart`.
* **Timeout Window:** **5 minutes (300 seconds)** without any detected user input.
* **Behavior:**
  * Every input event resets an internal countdown timer to 300 seconds.
  * If the timer elapses, the client status transitions to `IDLE`.
  * The first user input after `IDLE` immediately restores the status to `ACTIVE`.

### Rule 2: Tab Switching & Hidden State (> 5-Second Grace Period)
* **Trigger:** The student leaves the classroom tab (e.g., switches to another tab or minimizes the browser window).
* **Detection Methods:**
  * Web App: HTML5 `document.visibilityState === "hidden"` via the Page Visibility API.
  * Extension: `chrome.tabs.onActivated` and `chrome.tabs.onUpdated`.
* **Grace Period:** **5 seconds**.
* **Behavior:**
  * Switching tabs starts a 5-second grace timer.
  * If the student returns within 5 seconds (e.g., accidental tab switch), no violation is logged.
  * If the tab remains hidden for $> 5$ seconds, the status transitions to `TAB_AWAY` and emits an alert to the instructor.

### Rule 3: Window Blur / External Application Focus (> 10-Second Grace Period)
* **Trigger:** The browser window loses OS-level focus (e.g., student clicks onto another browser, a desktop app, or another monitor).
* **Detection Methods:**
  * Web App: `window.onblur` and `window.onfocus`.
  * Extension: `chrome.windows.onFocusChanged`.
* **Grace Period:** **10 seconds**.
* **Behavior:**
  * Losing window focus starts a 10-second timer.
  * If focus returns within 10 seconds (e.g., clicking an OS notification or system prompt), no violation is logged.
  * If focus is lost for $> 10$ seconds, the status transitions to `WINDOW_UNFOCUSED` and emits an alert to the instructor.

### Rule 4: Camera State (Hardware Toggle Only)
* **Detection Method:** Querying local `MediaStreamTrack` properties (`readyState === "live"` and `enabled === true`).
* **Behavior:**
  * Reports boolean status: `cameraOn: true` vs. `cameraOn: false`.
  * Status updates trigger immediately upon toggling the camera button or hardware mute.

### Rule 5: Facial Recognition & Biometrics (Explicitly Excluded)
* **Biometric Exemption:** **Zero facial detection, gaze tracking, head pose estimation, or camera image processing.**
* **Rationale:** Reduces computational load, removes student battery drain, eliminates computer vision false positives, and ensures absolute compliance with biometric data privacy laws.

---

## 4. Telemetry State & Event Matrix

| Event Code | Source | Condition | Grace Period | Severity | Instructor Dashboard Display |
| :--- | :--- | :--- | :--- | :--- | :--- |
| `STATUS_ACTIVE` | Web App | Input detected | None | Info | 🟢 **Active** |
| `STATUS_IDLE` | Web App | No input for 300s | 5 minutes | Low | 🟡 **Idle (> 5m)** |
| `TAB_HIDDEN` | Web App / Ext | Tab hidden | 5 seconds | Medium | 🟠 **Tab Switched** |
| `TAB_RESTORED` | Web App / Ext | Returned to class tab | None | Info | Clears tab alert |
| `WINDOW_BLURRED` | Web App / Ext | Window unfocused | 10 seconds | High | 🔴 **Off-Screen / Other App** |
| `WINDOW_FOCUSED` | Web App / Ext | Window focused | None | Info | Clears window alert |
| `CAM_ENABLED` | Web App | Camera track active | None | Info | 📹 **Camera ON** |
| `CAM_DISABLED` | Web App | Camera track disabled | None | Info | 🚫 **Camera OFF** |

---

## 5. Privacy, Ethics & Compliance Framework

1. **Student Transparency:**
   * Students are presented with a clear session indicator showing their current tracked status:
     * Current state: *Active*, *Idle*, *Tab Switched*, *Window Blurred*.
     * Camera status: *Camera ON* or *Camera OFF*.
   * Clear visual indicators ensure students know when monitoring is active and what is recorded.
2. **Zero Biometric Processing:**
   * No images or video frames are inspected, saved, or uploaded to servers.
   * Full compliance with student privacy regulations (**FERPA**, **COPPA**, **GDPR Article 9** biometric restrictions).
3. **No Keylogging or Content Capture:**
   * Keyboard activity listeners detect *presence of input* (`keydown` event timestamp), never *keys pressed* (`event.key` or `event.code` are strictly discarded).
   * The extension tracks domain switching indicators, not sensitive keystrokes, personal passwords, or private messaging content.

---

## 6. Implementation Acceptance Criteria (Phase 1 Sign-Off)

- [x] **Deployment Model Finalized:** Hybrid Web App + Browser Extension (Option B).
- [x] **Activity Rules Defined:** 5-minute idle countdown based on mouse/keyboard interactions.
- [x] **Tab & Window Grace Periods Set:** Tab switch alerts after 5 seconds; window blur alerts after 10 seconds.
- [x] **Camera Tracking Scope Defined:** Binary on/off hardware state only; no video or frame processing.
- [x] **Facial Recognition Scope:** Explicitly omitted to protect student privacy and minimize device resource usage.
- [x] **Data Privacy Principles Established:** Transparent status UI, zero biometric storage, zero keylogging.

---

## 7. Next Phase: Phase 2 Preview

With Phase 1 requirements signed off, the next phase (**Phase 2: System & Architecture Design**) will cover:
1. **Relational Database Schema (PostgreSQL):** Tables for `Users`, `Classrooms`, `Sessions`, `AttendanceRecords`, and `ActivityLogs`.
2. **Real-Time WebSocket Protocol:** JSON message formats for heartbeats, alert notifications, and teacher synchronization.
3. **Browser Extension Manifest & Architecture:** Permissions, content scripts, background service worker, and message bridge.
4. **Instructor Dashboard Wireframe & State Management:** Live student grid layout, badge colors, and filtering mechanisms.
