/**
 * SmartSnapshot Background Service Worker
 * Handles extension icon click and communication with content scripts
 */

// Track active selection state per tab
const activeTabs = new Set();

async function captureVisibleTabDataUrl() {
  return chrome.tabs.captureVisibleTab({
    format: 'png',
    quality: 100
  });
}

async function captureTabCroppedWithDebugger(tabId, width, height) {
  const target = { tabId };
  const clipWidth = Math.max(1, Math.floor(Number(width) || 0));
  const clipHeight = Math.max(1, Math.floor(Number(height) || 0));

  if (!clipWidth || !clipHeight) {
    throw new Error('Invalid clip size');
  }

  await chrome.debugger.attach(target, '1.3');
  try {
    const result = await chrome.debugger.sendCommand(target, 'Page.captureScreenshot', {
      format: 'png',
      fromSurface: true,
      captureBeyondViewport: true,
      clip: {
        x: 0,
        y: 0,
        width: clipWidth,
        height: clipHeight,
        scale: 1
      }
    });

    if (!result?.data) {
      throw new Error('No screenshot data returned');
    }

    return `data:image/png;base64,${result.data}`;
  } finally {
    try {
      await chrome.debugger.detach(target);
    } catch (e) {}
  }
}

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
    captureVisibleTabDataUrl().then(dataUrl => {
      sendResponse(dataUrl);
    }).catch(error => {
      console.error('Capture failed:', error);
      sendResponse(null);
    });
    return true; // Keep message channel open for async
  }

  if (request.action === 'captureTabCropped') {
    if (!sender.tab?.id) {
      sendResponse({ dataUrl: null, method: null, error: 'No sender tab id' });
      return false;
    }

    captureTabCroppedWithDebugger(sender.tab.id, request.width, request.height)
      .then((dataUrl) => {
        sendResponse({ dataUrl, method: 'cdp' });
      })
      .catch(async (error) => {
        console.warn('Cropped capture failed, fallback to captureVisibleTab:', error);
        try {
          const dataUrl = await captureVisibleTabDataUrl();
          sendResponse({ dataUrl, method: 'captureVisibleTab', fallback: true });
        } catch (fallbackError) {
          console.error('Capture fallback failed:', fallbackError);
          sendResponse({ dataUrl: null, method: null, error: fallbackError.message });
        }
      });

    return true;
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

  if (request.action === 'showPreview') {
    // 将预览数据存入 storage，然后打开预览页面
    const { htmlContent, filename, width, height } = request;
    
    // 保存预览数据到 storage
    chrome.storage.local.set({
      previewData: { htmlContent, filename, width, height }
    }).then(() => {
      // 打开预览页面
      const previewUrl = chrome.runtime.getURL('preview.html');
      return chrome.tabs.create({ url: previewUrl });
    }).then(() => {
      sendResponse({ success: true });
    }).catch((error) => {
      console.error('Failed to open preview:', error);
      sendResponse({ success: false, error: error.message });
    });
    
    return true; // Keep message channel open for async
  }

  return false;
});