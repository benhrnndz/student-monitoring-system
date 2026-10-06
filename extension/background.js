/**
 * Background Service Worker (Manifest V3)
 * Manages WebSocket telemetry for both Classroom Portal tabs and Google Meet tabs.
 */

// Monitored tabs sets
let monitoredPortalTabs = new Set();
let monitoredMeetTabs = new Set();

// Active tracking states
let activeTabId = null;
let tabGraceTimer = null;
let windowGraceTimer = null;
let idleTimer = null;
let heartbeatInterval = null;

let currentStatus = "ACTIVE";
let isCameraOn = false;

// Default session configuration (Using 127.0.0.1 to avoid Windows IPv6 localhost connection refusals)
let config = {
  sessionId: "live-demo-session",
  studentId: "stu-" + Math.random().toString(36).substring(2, 10),
  studentName: "",
  wsBaseUrl: "ws://127.0.0.1:8000/ws/session",
};

// Load saved config from chrome.storage.local with automatic localhost -> 127.0.0.1 migration
chrome.storage.local.get(["sessionId", "studentId", "studentName", "wsBaseUrl"], (res) => {
  if (res.sessionId) config.sessionId = res.sessionId;
  if (res.studentId) {
    config.studentId = res.studentId;
  } else {
    config.studentId = "stu-" + Math.random().toString(36).substring(2, 10);
    chrome.storage.local.set({ studentId: config.studentId });
  }
  if (res.studentName) config.studentName = res.studentName;
  if (res.wsBaseUrl) {
    // Migrate any stored 'localhost' to '127.0.0.1' to prevent net::ERR_CONNECTION_REFUSED on Windows
    config.wsBaseUrl = res.wsBaseUrl.replace("//localhost:", "//127.0.0.1:");
    chrome.storage.local.set({ wsBaseUrl: config.wsBaseUrl });
  }
  console.log("[Background] Loaded configuration:", config);
});

// WebSocket management
let socket = null;
let isSocketConnected = false;

function getNormalizedWsUrl() {
  const base = (config.wsBaseUrl || "ws://127.0.0.1:8000/ws/session").replace("//localhost:", "//127.0.0.1:");
  return `${base}/${config.sessionId}?role=student&user_id=${encodeURIComponent(
    config.studentId
  )}&user_name=${encodeURIComponent(config.studentName)}&source=google_meet&extension=true`;
}

function connectWebSocket() {
  if (socket && (socket.readyState === WebSocket.OPEN || socket.readyState === WebSocket.CONNECTING)) {
    return;
  }

  const url = getNormalizedWsUrl();
  console.log("[Background] Connecting WebSocket to:", url);

  try {
    socket = new WebSocket(url);

    socket.onopen = () => {
      isSocketConnected = true;
      console.log("[Background] WebSocket connected for Google Meet telemetry");
      broadcastToTabs({ type: "WS_STATUS_CHANGE", connected: true, config });

      // Send IMMEDIATE presence announcement so teacher dashboard reflects Google Meet presence right away!
      sendWsMessage({
        event: "telemetry:heartbeat",
        sessionId: config.sessionId,
        timestamp: Date.now(),
        payload: {
          studentId: config.studentId,
          name: config.studentName,
          status: currentStatus,
          cameraOn: isCameraOn,
          source: "GOOGLE_MEET",
          platform: "GOOGLE_MEET",
          extensionActive: true,
        },
      });

      // Start 15s heartbeat
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      heartbeatInterval = setInterval(sendHeartbeat, 15000);
    };

    socket.onmessage = (event) => {
      try {
        const msg = JSON.parse(event.data);
        console.log("[Background] WS Message received:", msg.event);

        if (msg.event === "student:nudge") {
          // Broadcast nudge alert to all Google Meet tabs & portal tabs
          broadcastToTabs({
            type: "SHOW_FOCUS_NUDGE",
            message: msg.payload?.message || "Your instructor is checking on your engagement.",
          });
        }
      } catch (err) {
        console.error("[Background] Error parsing WS message:", err);
      }
    };

    socket.onclose = () => {
      isSocketConnected = false;
      console.log("[Background] WebSocket closed. Reconnecting in 5s...");
      broadcastToTabs({ type: "WS_STATUS_CHANGE", connected: false });
      if (heartbeatInterval) clearInterval(heartbeatInterval);
      setTimeout(connectWebSocket, 5000);
    };

    socket.onerror = (err) => {
      console.warn("[Background] WebSocket connection warning (will retry):", err);
    };
  } catch (err) {
    console.warn("[Background] Could not instantiate WebSocket:", err);
  }
}

function sendWsMessage(payload) {
  if (socket && socket.readyState === WebSocket.OPEN) {
    socket.send(JSON.stringify(payload));
  }
}

function sendStatusChange(newStatus, reason, gracePeriodSeconds = 5) {
  currentStatus = newStatus;
  const msg = {
    event: "telemetry:status_change",
    sessionId: config.sessionId,
    timestamp: Date.now(),
    payload: {
      studentId: config.studentId,
      name: config.studentName,
      previousStatus: currentStatus,
      newStatus: newStatus,
      reason: reason,
      gracePeriodSeconds: gracePeriodSeconds,
      cameraOn: isCameraOn,
      source: monitoredMeetTabs.size > 0 ? "GOOGLE_MEET" : "CLASSROOM_PORTAL",
    },
  };
  sendWsMessage(msg);
  broadcastToTabs({ type: "STATUS_UPDATED", status: newStatus, reason: reason });
}

function sendHeartbeat() {
  const msg = {
    event: "telemetry:heartbeat",
    sessionId: config.sessionId,
    timestamp: Date.now(),
    payload: {
      studentId: config.studentId,
      status: currentStatus,
      cameraOn: isCameraOn,
    },
  };
  sendWsMessage(msg);
}

function broadcastToTabs(message) {
  const allTabs = new Set([...monitoredPortalTabs, ...monitoredMeetTabs]);
  allTabs.forEach((tabId) => {
    chrome.tabs.sendMessage(tabId, message).catch(() => {
      monitoredPortalTabs.delete(tabId);
      monitoredMeetTabs.delete(tabId);
    });
  });
}

// -------------------------------------------------------------
// Message Listener from Content Scripts & Extension Popup
// -------------------------------------------------------------
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  const tabId = sender.tab ? sender.tab.id : null;

  // 1. Portal registration
  if (message.type === "REGISTER_MONITORED_TAB" && tabId) {
    monitoredPortalTabs.add(tabId);
    sendResponse({ status: "OK", tabId });
  }

  // 2. Google Meet registration
  if (message.type === "REGISTER_MEET_TAB" && tabId) {
    monitoredMeetTabs.add(tabId);
    console.log(`[Background] Registered Google Meet tab ${tabId}`);
    connectWebSocket(); // Ensure telemetry WebSocket is active
    sendResponse({
      status: "OK",
      tabId,
      connected: isSocketConnected,
      config,
    });
  }

  // 3. Google Meet camera toggle
  if (message.type === "MEET_CAMERA_TOGGLE") {
    isCameraOn = !!message.cameraOn;
    sendWsMessage({
      event: "telemetry:camera_toggle",
      sessionId: config.sessionId,
      timestamp: Date.now(),
      payload: {
        studentId: config.studentId,
        cameraOn: isCameraOn,
      },
    });
    sendResponse({ status: "OK" });
  }

  // 4. Activity in Meet resets idle timer
  if (message.type === "MEET_USER_ACTIVITY") {
    if (currentStatus === "IDLE") {
      sendStatusChange("ACTIVE", "Resumed activity in Google Meet");
    }
  }

  // 5. Nudge acknowledgement from in-meeting HUD
  if (message.type === "ACKNOWLEDGE_NUDGE") {
    sendStatusChange("ACTIVE", "Acknowledged instructor nudge in Google Meet");
    sendResponse({ status: "OK" });
  }

  // 6. Settings synchronization
  if (message.type === "SYNC_CONFIG") {
    config = { ...config, ...message.config };
    chrome.storage.local.set(config);
    if (socket) {
      socket.close();
      connectWebSocket();
    }
    sendResponse({ status: "OK", config });
  }

  // 7. Request current status
  if (message.type === "GET_STATUS") {
    sendResponse({
      currentStatus,
      isCameraOn,
      isSocketConnected,
      config,
      meetTabsCount: monitoredMeetTabs.size,
      portalTabsCount: monitoredPortalTabs.size,
    });
  }

  return true;
});

// -------------------------------------------------------------
// Global Tab Activation Listener (Tab Switching Detection)
// -------------------------------------------------------------
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  activeTabId = activeInfo.tabId;
  const isMeetActive = monitoredMeetTabs.has(activeTabId);
  const isPortalActive = monitoredPortalTabs.has(activeTabId);
  const isClassroomActive = isMeetActive || isPortalActive;

  if (monitoredMeetTabs.size > 0 || monitoredPortalTabs.size > 0) {
    if (!isClassroomActive) {
      // Student switched to an unrelated tab (YouTube, Reddit, etc.)
      if (!tabGraceTimer && currentStatus === "ACTIVE") {
        console.log("[Background] Switched away from classroom tab. Starting 5s grace period...");
        tabGraceTimer = setTimeout(() => {
          sendStatusChange("TAB_AWAY", "Navigated away from class/Meet tab > 5s", 5);
          tabGraceTimer = null;
        }, 5000);
      }
    } else {
      // Student returned to a monitored classroom or Google Meet tab
      if (tabGraceTimer) {
        clearTimeout(tabGraceTimer);
        tabGraceTimer = null;
      }
      if (currentStatus === "TAB_AWAY") {
        console.log("[Background] Returned to class/Meet tab. Restoring ACTIVE status.");
        sendStatusChange("ACTIVE", "Returned to Google Meet / Classroom");
      }
    }
  }
});

// -------------------------------------------------------------
// Window Focus Change Listener (External App / Window Blur)
// -------------------------------------------------------------
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (monitoredMeetTabs.size === 0 && monitoredPortalTabs.size === 0) return;

  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // Window lost OS focus (user switched to another desktop window or minimized browser)
    if (!windowGraceTimer && currentStatus === "ACTIVE") {
      console.log("[Background] Window lost OS focus. Starting 10s grace period...");
      windowGraceTimer = setTimeout(() => {
        sendStatusChange("WINDOW_UNFOCUSED", "Browser window blurred or minimized > 10s", 10);
        windowGraceTimer = null;
      }, 10000);
    }
  } else {
    // Regained focus
    if (windowGraceTimer) {
      clearTimeout(windowGraceTimer);
      windowGraceTimer = null;
    }
    if (currentStatus === "WINDOW_UNFOCUSED") {
      console.log("[Background] Browser window refocused. Restoring ACTIVE status.");
      sendStatusChange("ACTIVE", "Browser window regained focus");
    }
  }
});

// Clean up closed tabs
chrome.tabs.onRemoved.addListener((tabId) => {
  monitoredPortalTabs.delete(tabId);
  monitoredMeetTabs.delete(tabId);
});
