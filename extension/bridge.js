/**
 * Content Script Bridge
 * Mediates communication between background service worker and the web page DOM.
 */

// 1. Register this tab with the extension background worker
try {
  chrome.runtime.sendMessage({ type: "REGISTER_MONITORED_TAB" }, (response) => {
    if (chrome.runtime.lastError) {
      console.warn("[Bridge] Extension background not reachable:", chrome.runtime.lastError.message);
    } else {
      console.log("[Bridge] Tab registered successfully with extension:", response);
      // Notify the web page that extension is active
      window.postMessage(
        {
          type: "EXTENSION_HANDSHAKE_ACK",
          version: "1.0.0",
          verified: true,
        },
        "*"
      );
    }
  });
} catch (e) {
  console.warn("[Bridge] Error registering tab:", e);
}

// 2. Listen for messages from background service worker and relay to web page DOM
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type) {
    window.postMessage(message, "*");
  }
  sendResponse({ received: true });
});

// 3. Listen for pings from the web page DOM
window.addEventListener("message", (event) => {
  if (event.data && event.data.type === "CLASSROOM_EXT_PING") {
    window.postMessage(
      {
        type: "EXTENSION_HANDSHAKE_ACK",
        version: "1.0.0",
        verified: true,
      },
      "*"
    );
  }
});

