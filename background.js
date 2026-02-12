/**
 * SmartSnapshot Background Service Worker
 * Handles extension icon click and communication with content scripts
 */

// Track active selection state per tab
const activeTabs = new Set();

/**
 * Handle extension icon click
 * Toggles selection mode on the active tab
 */
chrome.action.onClicked.addListener(async (tab) => {
  if (!tab.id) return;

  const isActive = activeTabs.has(tab.id);

  try {
    if (!isActive) {
      // Activate selection mode
      activeTabs.add(tab.id);
      
      // Inject content script if not already injected
      await chrome.scripting.executeScript({
        target: { tabId: tab.id },
        files: ['content-script.js']
      }).catch(() => {}); // Script might already be injected

      // Send message to start selection mode
      await chrome.tabs.sendMessage(tab.id, { 
        action: 'startSelection',
        url: tab.url,
        domain: new URL(tab.url).hostname
      });

      // Update icon badge
      chrome.action.setBadgeText({
        tabId: tab.id,
        text: 'ON'
      });
      chrome.action.setBadgeBackgroundColor({
        tabId: tab.id,
        color: '#4CAF50'
      });

    } else {
      // Deactivate selection mode
      activeTabs.delete(tab.id);
      
      await chrome.tabs.sendMessage(tab.id, { 
        action: 'stopSelection' 
      }).catch(() => {});

      // Clear badge
      chrome.action.setBadgeText({
        tabId: tab.id,
        text: ''
      });
    }
  } catch (error) {
    console.error('SmartSnapshot error:', error);
  }
});

/**
 * Clean up when tab is closed
 */
chrome.tabs.onRemoved.addListener((tabId) => {
  activeTabs.delete(tabId);
});

/**
 * Listen for messages from content script
 */
chrome.runtime.onMessage.addListener((request, sender, sendResponse) => {
  if (request.action === 'selectionStopped' && sender.tab?.id) {
    activeTabs.delete(sender.tab.id);
    chrome.action.setBadgeText({
      tabId: sender.tab.id,
      text: ''
    });
    return false;
  }
  
  if (request.action === 'captureTab') {
    // Capture the active tab
    chrome.tabs.captureVisibleTab({
      format: 'png',
      quality: 100
    }).then(dataUrl => {
      sendResponse(dataUrl);
    }).catch(error => {
      console.error('Capture failed:', error);
      sendResponse(null);
    });
    return true; // Keep message channel open for async
  }
  
  if (request.action === 'downloadScreenshot') {
    // Download screenshot
    chrome.downloads.download({
      url: request.dataUrl,
      filename: request.filename,
      saveAs: false
    }).then(() => {
      sendResponse({ success: true });
    }).catch((error) => {
      console.error('Download failed:', error);
      sendResponse({ success: false, error: error.message });
    });
    return true; // Keep message channel open for async
  }

  return false;
});