/**
 * StudentTelemetryTracker - Core telemetry engine for student monitoring.
 * Validated in Phase 3 PoC.
 */
export class StudentTelemetryTracker {
  constructor(options = {}) {
    this.options = {
      idleTimeoutMs: options.idleTimeoutMs || 300000,    // 5 minutes
      tabGraceMs: options.tabGraceMs || 5000,            // 5 seconds
      windowGraceMs: options.windowGraceMs || 10000,      // 10 seconds
      heartbeatIntervalMs: options.heartbeatIntervalMs || 15000, // 15 seconds
      onStatusChange: options.onStatusChange || (() => {}),
      onCameraChange: options.onCameraChange || (() => {}),
      onExtensionDetected: options.onExtensionDetected || (() => {}),
      onLog: options.onLog || (() => {}),
    };

    // State
    this.currentStatus = "ACTIVE"; // ACTIVE | IDLE | TAB_AWAY | WINDOW_UNFOCUSED
    this.isCameraOn = false;
    this.isExtensionAttached = false;
    this.mediaStream = null;
    this.lastInputTimestamp = Date.now();

    // Timers
    this.idleTimer = null;
    this.tabGraceTimer = null;
    this.windowGraceTimer = null;
    this.heartbeatTimer = null;

    // Bound listeners for clean teardown
    this._handleUserInput = this._debounce(this._handleUserInput.bind(this), 250);
    this._handleVisibilityChange = this._handleVisibilityChange.bind(this);
    this._handleWindowBlur = this._handleWindowBlur.bind(this);
    this._handleWindowFocus = this._handleWindowFocus.bind(this);
    this._handleExtensionMessage = this._handleExtensionMessage.bind(this);
  }

  /**
   * Initializes all event listeners and starts monitoring.
   */
  start() {
    this.log("Initializing telemetry tracker...");

    // 1. User interaction listeners for 5-minute idle countdown
    const inputEvents = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
    inputEvents.forEach((event) => {
      window.addEventListener(event, this._handleUserInput, { passive: true });
    });

    // 2. HTML5 Page Visibility API (Tab switching)
    document.addEventListener("visibilitychange", this._handleVisibilityChange);

    // 3. Window blur/focus listeners (External app / secondary monitor)
    window.addEventListener("blur", this._handleWindowBlur);
    window.addEventListener("focus", this._handleWindowFocus);

    // 4. Companion extension message bridge
    window.addEventListener("message", this._handleExtensionMessage);

    // 5. Start the idle countdown timer
    this._resetIdleTimer();

    // 6. Ping for companion extension
    window.postMessage({ type: "CLASSROOM_EXT_PING" }, "*");

    this.log("Telemetry tracker active. Status: ACTIVE");
  }

  /**
   * Stops all timers and removes listeners.
   */
  stop() {
    const inputEvents = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
    inputEvents.forEach((event) => {
      window.removeEventListener(event, this._handleUserInput);
    });

    document.removeEventListener("visibilitychange", this._handleVisibilityChange);
    window.removeEventListener("blur", this._handleWindowBlur);
    window.removeEventListener("focus", this._handleWindowFocus);
    window.removeEventListener("message", this._handleExtensionMessage);

    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (this.tabGraceTimer) clearTimeout(this.tabGraceTimer);
    if (this.windowGraceTimer) clearTimeout(this.windowGraceTimer);
    if (this.heartbeatTimer) clearInterval(this.heartbeatTimer);

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
    }

    this.log("Telemetry tracker stopped.");
  }

  /**
   * Connects and monitors the student's webcam hardware status (zero video processing).
   */
  async requestCamera() {
    try {
      this.log("Requesting camera access (hardware status check only)...");
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240 },
        audio: false,
      });

      this._evaluateCameraState();

      // Listen to track mute/unmute or ended events
      const videoTrack = this.mediaStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => this._evaluateCameraState();
        videoTrack.onmute = () => this._evaluateCameraState();
        videoTrack.onunmute = () => this._evaluateCameraState();
      }

      return this.mediaStream;
    } catch (err) {
      this.log(`Camera access denied or unavailable: ${err.message}`, "warn");
      this.isCameraOn = false;
      this.options.onCameraChange(false);
      return null;
    }
  }

  /**
   * Toggles camera track enabled status (simulating in-class camera toggle).
   */
  toggleCamera() {
    if (!this.mediaStream) return false;
    const videoTrack = this.mediaStream.getVideoTracks()[0];
    if (videoTrack) {
      videoTrack.enabled = !videoTrack.enabled;
      this._evaluateCameraState();
      return videoTrack.enabled;
    }
    return false;
  }

  _evaluateCameraState() {
    if (!this.mediaStream) {
      this.isCameraOn = false;
    } else {
      const track = this.mediaStream.getVideoTracks()[0];
      this.isCameraOn = !!(track && track.enabled && track.readyState === "live");
    }
    this.log(`Camera status updated: ${this.isCameraOn ? "ON (📹)" : "OFF (🚫)"}`);
    this.options.onCameraChange(this.isCameraOn);
  }

  // --- Handlers ---

  _handleUserInput() {
    this.lastInputTimestamp = Date.now();

    // If currently marked IDLE, restore to ACTIVE immediately on input
    if (this.currentStatus === "IDLE") {
      this._transitionStatus("ACTIVE", "User input resumed");
    }

    this._resetIdleTimer();
  }

  _resetIdleTimer() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      // Only transition to IDLE if not already in an away/unfocused state
      if (this.currentStatus === "ACTIVE") {
        this._transitionStatus("IDLE", `No input for ${this.options.idleTimeoutMs / 1000}s`);
      }
    }, this.options.idleTimeoutMs);
  }

  _handleVisibilityChange() {
    if (document.hidden) {
      this.log(`Tab hidden. 5-second grace period started...`);
      if (this.tabGraceTimer) clearTimeout(this.tabGraceTimer);

      this.tabGraceTimer = setTimeout(() => {
        this._transitionStatus("TAB_AWAY", "Tab hidden for > 5 seconds");
      }, this.options.tabGraceMs);
    } else {
      if (this.tabGraceTimer) {
        clearTimeout(this.tabGraceTimer);
        this.tabGraceTimer = null;
      }

      this.log("Tab returned to focus.");
      if (this.currentStatus === "TAB_AWAY") {
        this._transitionStatus("ACTIVE", "Returned to classroom tab");
        this._resetIdleTimer();
      }
    }
  }

  _handleWindowBlur() {
    this.log(`Window lost focus (blur). 10-second grace period started...`);
    if (this.windowGraceTimer) clearTimeout(this.windowGraceTimer);

    this.windowGraceTimer = setTimeout(() => {
      // Only set to WINDOW_UNFOCUSED if not already marked TAB_AWAY
      if (this.currentStatus !== "TAB_AWAY") {
        this._transitionStatus("WINDOW_UNFOCUSED", "Window unfocused for > 10 seconds");
      }
    }, this.options.windowGraceMs);
  }

  _handleWindowFocus() {
    if (this.windowGraceTimer) {
      clearTimeout(this.windowGraceTimer);
      this.windowGraceTimer = null;
    }

    this.log("Window regained focus.");
    if (this.currentStatus === "WINDOW_UNFOCUSED") {
      this._transitionStatus("ACTIVE", "Window focused");
      this._resetIdleTimer();
    }
  }

  _handleExtensionMessage(event) {
    if (!event.data || typeof event.data !== "object") return;

    if (event.data.type === "EXTENSION_HANDSHAKE_ACK") {
      this.isExtensionAttached = true;
      this.log(`Extension verified (v${event.data.version}). Companion tracking active.`);
      this.options.onExtensionDetected(event.data);
    }

    if (event.data.type === "EXTENSION_TAB_SWITCHED_AWAY") {
      this.log(`[Extension] Student switched to another tab: ${event.data.tabTitle || "External Tab"}`);
      // Extension detected external tab activation
      if (!this.tabGraceTimer && this.currentStatus !== "TAB_AWAY") {
        this.tabGraceTimer = setTimeout(() => {
          this._transitionStatus("TAB_AWAY", "Extension detected tab switch > 5s");
        }, this.options.tabGraceMs);
      }
    }

    if (event.data.type === "EXTENSION_TAB_RETURNED") {
      this.log(`[Extension] Student returned to class tab.`);
      if (this.tabGraceTimer) {
        clearTimeout(this.tabGraceTimer);
        this.tabGraceTimer = null;
      }
      if (this.currentStatus === "TAB_AWAY") {
        this._transitionStatus("ACTIVE", "Returned to classroom via extension");
      }
    }
  }

  _transitionStatus(newStatus, reason = "") {
    const prev = this.currentStatus;
    if (prev === newStatus) return;

    this.currentStatus = newStatus;
    this.log(`[State Transition] ${prev} ➔ ${newStatus} (${reason})`, "status");
    this.options.onStatusChange(newStatus, prev, {
      reason,
      timestamp: Date.now(),
      cameraOn: this.isCameraOn,
      extensionAttached: this.isExtensionAttached,
    });
  }

  log(message, type = "info") {
    this.options.onLog(message, type);
  }

  _debounce(func, wait) {
    let timeout;
    return (...args) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func.apply(this, args), wait);
    };
  }
}

