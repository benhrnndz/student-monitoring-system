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
  const observer = new MutationObserver(() => {
    checkMeetCameraState();
  });

  observer.observe(document.documentElement, {
    childList: true,
    subtree: true,
    attributes: true,
    attributeFilter: ["aria-label", "data-is-muted", "class"],
  });

  // Initial check
  checkMeetCameraState();

  // -------------------------------------------------------------
  // 3. User Activity inside Meet (Mouse / Keyboard Activity)
  // -------------------------------------------------------------
  function handleMeetInteraction() {
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
    hudContainer.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    hudContainer.style.fontSize = "11px";
    hudContainer.style.padding = "6px 14px";
    hudContainer.style.borderRadius = "9999px";
    hudContainer.style.backgroundColor = "rgba(255, 255, 255, 0.95)";
    hudContainer.style.backdropFilter = "blur(8px)";
    hudContainer.style.border = "1px solid rgba(15, 23, 42, 0.12)";
    hudContainer.style.color = "#0a152d";
    hudContainer.style.display = "flex";
    hudContainer.style.alignItems = "center";
    hudContainer.style.gap = "8px";
    hudContainer.style.boxShadow = "0 4px 16px rgba(0, 0, 0, 0.12)";
    hudContainer.style.userSelect = "none";
    hudContainer.style.cursor = "pointer";
    hudContainer.title = "ClassPulse Companion (Zero Biometrics Active)";

    hudContainer.innerHTML = `
      <span id="lm-hud-dot" style="width: 6px; height: 6px; border-radius: 9999px; background: #10b981; display: inline-block;"></span>
      <span style="font-weight: 700; color: #475569; letter-spacing: 0.3px; text-transform: uppercase; font-size: 10px;">Monitor:</span>
      <span id="lm-hud-status" style="color: #047857; font-weight: 700;">ACTIVE</span>
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
      statusText.style.color = "#047857";
      statusText.textContent = "ACTIVE";
    } else if (status === "IDLE") {
      dot.style.background = "#f59e0b";
      statusText.style.color = "#b45309";
      statusText.textContent = "IDLE";
    } else if (status === "TAB_AWAY" || status === "WINDOW_UNFOCUSED") {
      dot.style.background = "#f43f5e";
      statusText.style.color = "#be123c";
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
    const existing = document.getElementById("learning-monitor-nudge-modal");
    if (existing) existing.remove();

    const modal = document.createElement("div");
    modal.id = "learning-monitor-nudge-modal";
    modal.style.position = "fixed";
    modal.style.top = "24px";
    modal.style.left = "50%";
    modal.style.transform = "translateX(-50%)";
    modal.style.zIndex = "1000000";
    modal.style.width = "400px";
    modal.style.maxWidth = "90vw";
    modal.style.backgroundColor = "#ffffff";
    modal.style.border = "1px solid #cbd5e1";
    modal.style.borderRadius = "14px";
    modal.style.boxShadow = "0 20px 45px rgba(0, 0, 0, 0.2)";
    modal.style.padding = "16px";
    modal.style.color = "#0f172a";
    modal.style.fontFamily = "-apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif";
    modal.style.display = "flex";
    modal.style.flexDirection = "column";
    modal.style.gap = "12px";
    modal.style.animation = "lmSlideDown 0.25s cubic-bezier(0.16, 1, 0.3, 1)";

    const styleTag = document.createElement("style");
    styleTag.textContent = `
      @keyframes lmSlideDown {
        from { opacity: 0; transform: translate(-50%, -16px); }
        to { opacity: 1; transform: translate(-50%, 0); }
      }
    `;
    modal.appendChild(styleTag);

    modal.innerHTML += `
      <div style="display: flex; align-items: center; gap: 10px;">
        <div style="width: 32px; height: 32px; border-radius: 8px; background: #0a152d; display: flex; align-items: center; justify-content: center; color: #ffffff; font-weight: 700; font-size: 13px;">
          CP
        </div>
        <div>
          <div style="font-weight: 700; font-size: 13px; color: #0a152d;">Instructor Focus Check-In</div>
          <div style="font-size: 11px; color: #64748b;">Classroom Engagement Prompt</div>
        </div>
      </div>
      <p style="margin: 0; font-size: 12px; line-height: 1.5; color: #334155; background: #f8fafc; padding: 10px 12px; border-radius: 8px; border: 1px solid #e2e8f0;">
        "${message || "Your instructor noticed you stepped away. Please refocus on class!"}"
      </p>
      <div style="display: flex; justify-content: flex-end; gap: 8px; margin-top: 2px;">
        <button id="lm-nudge-ack-btn" style="background: #0a152d; color: #ffffff; border: none; padding: 8px 16px; border-radius: 8px; font-weight: 600; font-size: 12px; cursor: pointer; transition: background 0.15s, transform 0.12s;">
          I'm Back & Attentive
        </button>
      </div>
    `;

    document.body.appendChild(modal);

    const ackBtn = document.getElementById("lm-nudge-ack-btn");
    if (ackBtn) {
      ackBtn.addEventListener("mousedown", () => {
        ackBtn.style.transform = "scale(0.97)";
      });
      ackBtn.addEventListener("mouseup", () => {
        ackBtn.style.transform = "scale(1)";
      });
      ackBtn.addEventListener("click", () => {
        chrome.runtime.sendMessage({ type: "ACKNOWLEDGE_NUDGE" });
        modal.style.opacity = "0";
        modal.style.transition = "opacity 0.15s";
        setTimeout(() => modal.remove(), 150);
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
