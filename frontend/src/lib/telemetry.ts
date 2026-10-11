/**
 * StudentTelemetryTracker - Client-side telemetry engine for React / Next.js
 */

export type StudentStatus = "ACTIVE" | "IDLE" | "TAB_AWAY" | "WINDOW_UNFOCUSED" | "DISCONNECTED";

export interface TelemetryOptions {
  idleTimeoutMs?: number;
  tabGraceMs?: number;
  windowGraceMs?: number;
  onStatusChange?: (newStatus: StudentStatus, prevStatus: StudentStatus, reason: string) => void;
  onCameraChange?: (isOn: boolean) => void;
  onExtensionDetected?: (data: any) => void;
  onLog?: (message: string, type?: "info" | "warn" | "status") => void;
}

export class StudentTelemetryTracker {
  options: Required<TelemetryOptions>;
  currentStatus: StudentStatus = "ACTIVE";
  isCameraOn: boolean = false;
  isExtensionAttached: boolean = false;
  mediaStream: MediaStream | null = null;
  lastInputTimestamp: number = Date.now();

  private idleTimer: any = null;
  private tabGraceTimer: any = null;
  private windowGraceTimer: any = null;

  private _handleUserInput: () => void;
  private _handleVisibilityChange: () => void;
  private _handleWindowBlur: () => void;
  private _handleWindowFocus: () => void;
  private _handleExtensionMessage: (event: MessageEvent) => void;

  constructor(options: TelemetryOptions = {}) {
    this.options = {
      idleTimeoutMs: options.idleTimeoutMs || 300000, // 5 minutes default
      tabGraceMs: options.tabGraceMs || 5000,          // 5 seconds
      windowGraceMs: options.windowGraceMs || 10000,    // 10 seconds
      onStatusChange: options.onStatusChange || (() => {}),
      onCameraChange: options.onCameraChange || (() => {}),
      onExtensionDetected: options.onExtensionDetected || (() => {}),
      onLog: options.onLog || (() => {}),
    };

    this._handleUserInput = this._debounce(this._onUserInput.bind(this), 200);
    this._handleVisibilityChange = this._onVisibilityChange.bind(this);
    this._handleWindowBlur = this._onWindowBlur.bind(this);
    this._handleWindowFocus = this._onWindowFocus.bind(this);
    this._handleExtensionMessage = this._onExtensionMessage.bind(this);
  }

  start() {
    if (typeof window === "undefined") return;

    const inputEvents = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
    inputEvents.forEach((ev) => {
      window.addEventListener(ev, this._handleUserInput, { passive: true });
    });

    document.addEventListener("visibilitychange", this._handleVisibilityChange);
    window.addEventListener("blur", this._handleWindowBlur);
    window.addEventListener("focus", this._handleWindowFocus);
    window.addEventListener("message", this._handleExtensionMessage);

    this._resetIdleTimer();
    window.postMessage({ type: "CLASSROOM_EXT_PING" }, "*");
    this.log("Telemetry tracker started. Status: ACTIVE");
  }

  stop() {
    if (typeof window === "undefined") return;

    const inputEvents = ["mousemove", "mousedown", "keydown", "scroll", "touchstart"];
    inputEvents.forEach((ev) => {
      window.removeEventListener(ev, this._handleUserInput);
    });

    document.removeEventListener("visibilitychange", this._handleVisibilityChange);
    window.removeEventListener("blur", this._handleWindowBlur);
    window.removeEventListener("focus", this._handleWindowFocus);
    window.removeEventListener("message", this._handleExtensionMessage);

    if (this.idleTimer) clearTimeout(this.idleTimer);
    if (this.tabGraceTimer) clearTimeout(this.tabGraceTimer);
    if (this.windowGraceTimer) clearTimeout(this.windowGraceTimer);

    if (this.mediaStream) {
      this.mediaStream.getTracks().forEach((track) => track.stop());
    }
  }

  async requestCamera(): Promise<MediaStream | null> {
    try {
      this.log("Requesting camera access (hardware state tracking only)...");
      this.mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { width: 320, height: 240 },
        audio: false,
      });

      this._evaluateCameraState();

      const videoTrack = this.mediaStream.getVideoTracks()[0];
      if (videoTrack) {
        videoTrack.onended = () => this._evaluateCameraState();
        videoTrack.onmute = () => this._evaluateCameraState();
        videoTrack.onunmute = () => this._evaluateCameraState();
      }

      return this.mediaStream;
    } catch (err: any) {
      this.log(`Camera unavailable: ${err.message}`, "warn");
      this.isCameraOn = false;
      this.options.onCameraChange(false);
      return null;
    }
  }

  toggleCamera(): boolean {
    if (!this.mediaStream) return false;
    const track = this.mediaStream.getVideoTracks()[0];
    if (track) {
      track.enabled = !track.enabled;
      this._evaluateCameraState();
      return track.enabled;
    }
    return false;
  }

  private _evaluateCameraState() {
    if (!this.mediaStream) {
      this.isCameraOn = false;
    } else {
      const track = this.mediaStream.getVideoTracks()[0];
      this.isCameraOn = !!(track && track.enabled && track.readyState === "live");
    }
    this.options.onCameraChange(this.isCameraOn);
  }

  private _onUserInput() {
    this.lastInputTimestamp = Date.now();
    if (this.currentStatus === "IDLE") {
      this._transitionStatus("ACTIVE", "User input resumed");
    }
    this._resetIdleTimer();
  }

  _resetIdleTimer() {
    if (this.idleTimer) clearTimeout(this.idleTimer);
    this.idleTimer = setTimeout(() => {
      if (this.currentStatus === "ACTIVE") {
        this._transitionStatus("IDLE", `No input for ${this.options.idleTimeoutMs / 1000}s`);
      }
    }, this.options.idleTimeoutMs);
  }

  private _onVisibilityChange() {
    if (document.hidden) {
      this.log("Tab hidden. 5-second grace period started...");
      if (this.tabGraceTimer) clearTimeout(this.tabGraceTimer);
      this.tabGraceTimer = setTimeout(() => {
        this._transitionStatus("TAB_AWAY", "Tab hidden > 5 seconds");
      }, this.options.tabGraceMs);
    } else {
      if (this.tabGraceTimer) {
        clearTimeout(this.tabGraceTimer);
        this.tabGraceTimer = null;
      }
      this.log("Returned to tab.");
      if (this.currentStatus === "TAB_AWAY") {
        this._transitionStatus("ACTIVE", "Returned to classroom tab");
        this._resetIdleTimer();
      }
    }
  }

  private _onWindowBlur() {
    this.log("Window blurred. 10-second grace period started...");
    if (this.windowGraceTimer) clearTimeout(this.windowGraceTimer);
    this.windowGraceTimer = setTimeout(() => {
      if (this.currentStatus !== "TAB_AWAY") {
        this._transitionStatus("WINDOW_UNFOCUSED", "Window unfocused > 10 seconds");
      }
    }, this.options.windowGraceMs);
  }

  private _onWindowFocus() {
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

  private _onExtensionMessage(event: MessageEvent) {
    if (!event.data || typeof event.data !== "object") return;

    if (event.data.type === "EXTENSION_HANDSHAKE_ACK") {
      this.isExtensionAttached = true;
      this.log(`Extension verified (v${event.data.version || "1.0.0"}).`);
      this.options.onExtensionDetected(event.data);
    }

    if (event.data.type === "EXTENSION_TAB_SWITCHED_AWAY") {
      if (!this.tabGraceTimer && this.currentStatus !== "TAB_AWAY") {
        this.tabGraceTimer = setTimeout(() => {
          this._transitionStatus("TAB_AWAY", "Extension detected tab switch > 5s");
        }, this.options.tabGraceMs);
      }
    }

    if (event.data.type === "EXTENSION_TAB_RETURNED") {
      if (this.tabGraceTimer) {
        clearTimeout(this.tabGraceTimer);
        this.tabGraceTimer = null;
      }
      if (this.currentStatus === "TAB_AWAY") {
        this._transitionStatus("ACTIVE", "Returned via extension");
      }
    }
  }

  private _transitionStatus(newStatus: StudentStatus, reason: string) {
    const prev = this.currentStatus;
    if (prev === newStatus) return;
    this.currentStatus = newStatus;
    this.log(`[Status] ${prev} ➔ ${newStatus} (${reason})`, "status");
    this.options.onStatusChange(newStatus, prev, reason);
  }

  log(message: string, type: "info" | "warn" | "status" = "info") {
    this.options.onLog(message, type);
  }

  private _debounce(func: Function, wait: number) {
    let timeout: any;
    return (...args: any[]) => {
      clearTimeout(timeout);
      timeout = setTimeout(() => func(...args), wait);
    };
  }
}
