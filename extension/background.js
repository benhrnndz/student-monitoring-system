/**
 * Background Service Worker (Manifest V3)
 * Tracks browser tab activations and window focus changes.
 */

let monitoredTabs = new Set();

// Listen for connections/messages from content script bridge
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === "REGISTER_MONITORED_TAB" && sender.tab) {
    monitoredTabs.add(sender.tab.id);
    console.log(`[Background] Registered tab ${sender.tab.id} for monitoring`);
    sendResponse({ status: "OK", tabId: sender.tab.id });
  }

  if (message.type === "UNREGISTER_MONITORED_TAB" && sender.tab) {
    monitoredTabs.delete(sender.tab.id);
    console.log(`[Background] Unregistered tab ${sender.tab.id}`);
    sendResponse({ status: "OK" });
  }
});

// Detect when a student activates a different tab
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  monitoredTabs.forEach((tabId) => {
    if (tabId !== activeInfo.tabId) {
      // The student is currently looking at a different tab!
      chrome.tabs.sendMessage(tabId, {
        type: "EXTENSION_TAB_SWITCHED_AWAY",
        activeTabId: activeInfo.tabId,
        timestamp: Date.now(),
      }).catch(() => {
        // Tab might have been closed without unregistering
        monitoredTabs.delete(tabId);
      });
    } else {
      // The student returned to this monitored classroom tab
      chrome.tabs.sendMessage(tabId, {
        type: "EXTENSION_TAB_RETURNED",
        timestamp: Date.now(),
      }).catch(() => {
        monitoredTabs.delete(tabId);
      });
    }
  });
});

// Detect when the entire browser window loses OS focus
chrome.windows.onFocusChanged.addListener((windowId) => {
  if (windowId === chrome.windows.WINDOW_ID_NONE) {
    // Student clicked out of Chrome/Edge entirely (to another app or desktop)
    monitoredTabs.forEach((tabId) => {
      chrome.tabs.sendMessage(tabId, {
        type: "EXTENSION_WINDOW_LOST_FOCUS",
        timestamp: Date.now(),
      }).catch(() => {
        monitoredTabs.delete(tabId);
      });
    });
  }
});

// Clean up closed tabs
chrome.tabs.onRemoved.addListener((tabId) => {
  monitoredTabs.delete(tabId);
});

