// Popup controller
document.addEventListener("DOMContentLoaded", () => {
  const studentNameInput = document.getElementById("studentName");
  const sessionIdInput = document.getElementById("sessionId");
  const wsBaseUrlInput = document.getElementById("wsBaseUrl");
  const saveBtn = document.getElementById("saveBtn");
  const openMeetBtn = document.getElementById("openMeetBtn");
  const openPortalBtn = document.getElementById("openPortalBtn");
  const toastMsg = document.getElementById("toastMsg");

  const hudStatus = document.getElementById("hud-status");
  const meetStatus = document.getElementById("meet-status");
  const wsStatus = document.getElementById("ws-status");

  let currentStudentId = null;

  // Query background service worker for live state
  chrome.runtime.sendMessage({ type: "GET_STATUS" }, (response) => {
    if (response) {
      if (response.config) {
        currentStudentId = response.config.studentId;
        studentNameInput.value = response.config.studentName || "";
        sessionIdInput.value = response.config.sessionId || "live-demo-session";
        wsBaseUrlInput.value = (response.config.wsBaseUrl || "wss://hope-wesley-strategic-generated.trycloudflare.com/ws/session").replace("//localhost:", "//127.0.0.1:");
      }

      if (response.currentStatus) {
        if (response.currentStatus === "ACTIVE") {
          hudStatus.innerHTML = '<span class="dot active"></span> Active';
          hudStatus.style.color = "#10b981";
        } else if (response.currentStatus === "IDLE") {
          hudStatus.innerHTML = '<span class="dot idle"></span> Idle (> 5m)';
          hudStatus.style.color = "#f59e0b";
        } else if (response.currentStatus === "TAB_AWAY") {
          hudStatus.innerHTML = '<span class="dot away"></span> Tab Away';
          hudStatus.style.color = "#f43f5e";
        } else if (response.currentStatus === "WINDOW_UNFOCUSED") {
          hudStatus.innerHTML = '<span class="dot away"></span> Window Blur';
          hudStatus.style.color = "#f43f5e";
        } else {
          hudStatus.innerHTML = `<span class="dot active"></span> ${response.currentStatus}`;
          hudStatus.style.color = "#10b981";
        }
      }

      if (response.meetTabsCount > 0) {
        meetStatus.textContent = `Active (${response.meetTabsCount} tab)`;
        meetStatus.style.color = "#10b981";
      } else {
        meetStatus.textContent = "Ready";
        meetStatus.style.color = "#60a5fa";
      }

      if (response.isSocketConnected) {
        wsStatus.innerHTML = '<span class="dot active"></span> Connected';
        wsStatus.style.color = "#10b981";
      } else {
        wsStatus.innerHTML = '<span class="dot offline"></span> Offline';
        wsStatus.style.color = "#94a3b8";
      }
    }
  });

  // Save Settings
  saveBtn.addEventListener("click", () => {
    const config = {
      studentId: currentStudentId || ("stu-" + Math.random().toString(36).substring(2, 10)),
      studentName: studentNameInput.value.trim() || ("Student-" + Math.floor(100 + Math.random() * 900)),
      sessionId: sessionIdInput.value.trim() || "live-demo-session",
      wsBaseUrl: (wsBaseUrlInput.value.trim() || "wss://hope-wesley-strategic-generated.trycloudflare.com/ws/session").replace("//localhost:", "//127.0.0.1:"),
    };

    chrome.runtime.sendMessage({ type: "SYNC_CONFIG", config }, () => {
      toastMsg.style.display = "block";
      setTimeout(() => {
        toastMsg.style.display = "none";
      }, 2500);
    });
  });

  // Open Google Meet
  openMeetBtn.addEventListener("click", () => {
    chrome.tabs.create({ url: "https://meet.google.com" });
  });

  // Open Classroom Portal
  openPortalBtn.addEventListener("click", () => {
    const session = sessionIdInput.value.trim() || "live-demo-session";
    chrome.tabs.create({ url: `http://localhost:3000/classroom/${session}` });
  });
});
