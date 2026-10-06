/**
 * Google Meet Integration Bridge (Content Script)
 * Injected into https://meet.google.com/*
 *
 * Responsibilities:
 * 1. Registers the Meet tab with the extension background worker.
 * 2. Monitors Google Meet hardware camera toggle state via DOM mutation observer.
 * 3. Injects an unobtrusive floating status indicator (privacy transparency).
 * 4. Displays real-time teacher focus check-in / nudge alerts directly in Meet.
 */

(function () {
  console.log("[MeetBridge] Student Learning Monitor injected into Google Meet");

  let currentCameraOn = false;
  let currentStatus = "ACTIVE";

  // -------------------------------------------------------------
  // 1. Register Meet Tab with Extension Background Worker
  // -------------------------------------------------------------
  chrome.runtime.sendMessage({ type: "REGISTER_MEET_TAB" }, (response) => {
    if (chrome.runtime.lastError) {
      console.warn("[MeetBridge] Extension worker not ready:", chrome.runtime.lastError.message);
    } else {
      console.log("[MeetBridge] Successfully registered Meet tab with extension:", response);
      updateHudStatus(response?.status || "ACTIVE");
    }
  });

  // -------------------------------------------------------------
  // 2. Google Meet Camera & Mic Hardware State Observer
  // -------------------------------------------------------------
  function checkMeetCameraState() {
    // Google Meet camera toggle button selectors
    const camBtn = document.querySelector(
      'button[aria-label*="camera" i], button[aria-label*="video" i], button[data-is-muted][jsname="B3n3fd"]'
    );

    if (camBtn) {
      const ariaLabel = (camBtn.getAttribute("aria-label") || "").toLowerCase();
      const isMutedAttr = camBtn.getAttribute("data-is-muted");

      let isOn = false;
      if (ariaLabel.includes("turn off camera") || ariaLabel.includes("turn off video")) {
        isOn = true;
      } else if (ariaLabel.includes("turn on camera") || ariaLabel.includes("turn on video")) {
        isOn = false;
      } else if (isMutedAttr === "false") {
        isOn = true;
      }

      if (isOn !== currentCameraOn) {
        currentCameraOn = isOn;
        console.log(`[MeetBridge] Camera state updated: ${isOn ? "ON" : "OFF"}`);
        chrome.runtime.sendMessage({ type: "MEET_CAMERA_TOGGLE", cameraOn: isOn });
      }
    }
  }

  // Observe DOM changes on Google Meet to detect button state changes
  const meetObserver = new MutationObserver(() => {
    checkMeetCameraState();
  });

  meetObserver.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["aria-label", "data-is-muted"],
  });

  // -------------------------------------------------------------
  // 3. Activity Tracker inside Meet (Resets Idle Timer)
  // -------------------------------------------------------------
  let activityThrottle = false;
  function handleMeetInteraction() {
    if (activityThrottle) return;
    activityThrottle = true;
    setTimeout(() => (activityThrottle = false), 2000);
    chrome.runtime.sendMessage({ type: "MEET_USER_ACTIVITY" });
  }

  window.addEventListener("mousemove", handleMeetInteraction, { passive: true });
  window.addEventListener("keydown", handleMeetInteraction, { passive: true });
  window.addEventListener("click", handleMeetInteraction, { passive: true });

  // -------------------------------------------------------------
  // 4. Floating In-Meeting HUD (Privacy-First Transparency)
  // -------------------------------------------------------------
  let hudContainer = null;

  function createMeetHud() {
    if (document.getElementById("learning-monitor-hud")) return;

    hudContainer = document.createElement("div");
    hudContainer.id = "learning-monitor-hud";
    hudContainer.style.position = "fixed";
    hudContainer.style.bottom = "84px";
    hudContainer.style.left = "20px";
    hudContainer.style.zIndex = "999999";
    hudContainer.style.fontFamily = "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif";
    hudContainer.style.fontSize = "12px";
    hudContainer.style.padding = "6px 12px";
    hudContainer.style.borderRadius = "20px";
    hudContainer.style.backgroundColor = "rgba(15, 23, 42, 0.85)";
    hudContainer.style.backdropFilter = "blur(8px)";
    hudContainer.style.border = "1px solid rgba(56, 189, 248, 0.3)";
    hudContainer.style.color = "#f8fafc";
    hudContainer.style.display = "flex";
    hudContainer.style.alignItems = "center";
    hudContainer.style.gap = "8px";
    hudContainer.style.boxShadow = "0 4px 12px rgba(0, 0, 0, 0.3)";
    hudContainer.style.userSelect = "none";
    hudContainer.style.cursor = "pointer";
    hudContainer.title = "Student Learning Monitor (Zero Biometrics Active)";

    hudContainer.innerHTML = `
      <span id="lm-hud-dot" style="width: 8px; height: 8px; border-radius: 50%; background: #10b981;"></span>
      <span style="font-weight: 600; color: #38bdf8;">Class Monitor:</span>
      <span id="lm-hud-status" style="color: #10b981; font-weight: 600;">ACTIVE</span>
    `;

    document.body.appendChild(hudContainer);
  }

  function updateHudStatus(status) {
    currentStatus = status;
    const dot = document.getElementById("lm-hud-dot");
    const statusText = document.getElementById("lm-hud-status");
    if (!dot || !statusText) return;

    if (status === "ACTIVE") {
      dot.style.background = "#10b981";
      statusText.style.color = "#10b981";
      statusText.textContent = "ACTIVE";
    } else if (status === "IDLE") {
      dot.style.background = "#f59e0b";
      statusText.style.color = "#f59e0b";
      statusText.textContent = "IDLE";
    } else if (status === "TAB_AWAY" || status === "WINDOW_UNFOCUSED") {
      dot.style.background = "#ef4444";
      statusText.style.color = "#ef4444";
      statusText.textContent = "AWAY";
    }
  }

  // Ensure HUD renders once Meet page is ready
  if (document.body) {
    createMeetHud();
  } else {
    window.addEventListener("DOMContentLoaded", createMeetHud);
  }

  // -------------------------------------------------------------
  // 5. In-Meeting Focus Nudge Modal (Alert from Professor)
  // -------------------------------------------------------------
  function showInMeetingNudge(message) {
    // Remove existing nudge if any
    const existing = document.getElementById("learning-monitor-nudge-modal");
    if (existing) existing.remove();

    const modal = document.createElement("div");
    modal.id = "learning-monitor-nudge-modal";
    modal.style.position = "fixed";
    modal.style.top = "24px";
    modal.style.left = "50%";
    modal.style.transform = "translateX(-50%)";
    modal.style.zIndex = "1000000";
    modal.style.width = "420px";
    modal.style.maxWidth = "90vw";
    modal.style.backgroundColor = "#0f172a";
    modal.style.border = "2px solid #3b82f6";
    modal.style.borderRadius = "16px";
    modal.style.boxShadow = "0 20px 40px rgba(0, 0, 0, 0.6), 0 0 20px rgba(59, 130, 246, 0.4)";
    modal.style.padding = "18px";
    modal.style.color = "#f8fafc";
    modal.style.fontFamily = "-apple-system, BlinkMacSystemFont, Segoe UI, Roboto, sans-serif";
    modal.style.display = "flex";
    modal.style.flexDirection = "column";
    modal.style.gap = "12px";
    modal.style.animation = "lmSlideDown 0.3s cubic-bezier(0.16, 1, 0.3, 1)";

    // Style animation
    const styleTag = document.createElement("style");
    styleTag.textContent = `
      @keyframes lmSlideDown {
        from { opacity: 0; transform: translate(-50%, -20px); }
        to { opacity: 1; transform: translate(-50%, 0); }
      }
    `;
    modal.appendChild(styleTag);

    modal.innerHTML += `
      <div style="display: flex; align-items: center; gap: 10px;">
        <div style="width: 36px; height: 36px; border-radius: 10px; background: rgba(59, 130, 246, 0.2); display: flex; align-items: center; justify-content: center; font-size: 18px;">
          🔔
        </div>
        <div>
          <div style="font-weight: 700; font-size: 14px; color: #60a5fa;">Instructor Focus Check-In</div>
          <div style="font-size: 11px; color: #94a3b8;">Classroom Engagement Prompt</div>
        </div>
      </div>
      <p style="margin: 0; font-size: 13px; line-height: 1.5; color: #e2e8f0; background: rgba(30, 41, 59, 0.6); padding: 10px 12px; border-radius: 8px; border: 1px solid rgba(51, 65, 85, 0.8);">
        "${message || "Your instructor is checking on your engagement. Please refocus on class!"}"
      </p>
      <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 4px;">
        <button id="lm-nudge-ack-btn" style="background: #2563eb; color: #ffffff; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 600; font-size: 12px; cursor: pointer; transition: background 0.2s;">
          ✓ I'm Listening & Focused
        </button>
      </div>
    `;

    document.body.appendChild(modal);

    const ackBtn = document.getElementById("lm-nudge-ack-btn");
    if (ackBtn) {
      ackBtn.addEventListener("click", () => {
        chrome.runtime.sendMessage({ type: "ACKNOWLEDGE_NUDGE" });
        modal.style.opacity = "0";
        modal.style.transition = "opacity 0.2s";
        setTimeout(() => modal.remove(), 200);
        updateHudStatus("ACTIVE");
      });
    }
  }

  // -------------------------------------------------------------
  // 6. Listen for Messages from Background Worker
  // -------------------------------------------------------------
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type === "SHOW_FOCUS_NUDGE") {
      showInMeetingNudge(message.message);
    }
    if (message.type === "STATUS_UPDATED") {
      updateHudStatus(message.status);
    }
  });
})();

