let previewData = null;
let lastCapturedImageDataUrl = "";

/**
 * Get localized message
 * @param {string} key - Message key
 * @param {string[]} [args] - Substitution arguments
 * @returns {string} Localized message
 */
function getMessage(key, args) {
  if (typeof chrome !== 'undefined' && chrome.i18n && chrome.i18n.getMessage) {
    return chrome.i18n.getMessage(key, args);
  }
  // Fallback messages (Chinese)
  const fallbacks = {
    'previewTitle': 'SmartSnapshot 预览',
    'previewLoading': '加载中，稍后将自动完成截图...',
    'previewEmpty': '正在加载预览内容...',
    'btnClose': '关闭',
    'btnRegenerate': '🔄 重新生成',
    'btnSaveScreenshot': '💾 保存截图',
    'modalTitle': '截图结果预览',
    'modalBtnClose': '关闭',
    'modalBtnRegenerate': '重新生成',
    'modalBtnSave': '保存截图',
    'statusGenerating': '正在生成截图...',
    'statusSuccess': '截图保存成功',
    'statusError': '生成失败，请重试'
  };
  return fallbacks[key] || key;
}

/**
 * Apply i18n to elements with data-i18n attribute
 */
function applyI18n() {
  document.querySelectorAll('[data-i18n]').forEach(el => {
    const key = el.getAttribute('data-i18n');
    const message = getMessage(key);
    if (message) {
      // For input elements, update value; for others, update textContent
      if (el.tagName === 'INPUT' || el.tagName === 'TEXTAREA') {
        el.value = message;
      } else {
        el.textContent = message;
      }
    }
  });
}

function showStatus(message, type = "success") {
  const status = document.getElementById("status");
  status.textContent = message;
  status.className = "status show " + type;
  setTimeout(() => status.classList.remove("show"), 3000);
}

function setActionButtonsBusy(isBusy, label) {
  const saveBtn = document.getElementById("saveBtn");
  const previewBtn = document.getElementById("previewShotBtn");

  if (saveBtn) {
    saveBtn.textContent = isBusy ? (label || getMessage('statusGenerating')) : getMessage('btnSaveScreenshot');
    saveBtn.disabled = isBusy || !lastCapturedImageDataUrl;
  }

  if (previewBtn) {
    previewBtn.textContent = isBusy ? (label || getMessage('statusGenerating')) : getMessage('btnRegenerate');
    previewBtn.disabled = isBusy;
  }
}

function openResultModal(imageDataUrl) {
  const modal = document.getElementById("resultModal");
  const image = document.getElementById("resultImage");
  if (!modal || !image) return;
  image.src = imageDataUrl;
  modal.classList.add("show");
}

function closeResultModal() {
  document.getElementById("resultModal")?.classList.remove("show");
}

function downloadDataUrl(dataUrl, filename) {
  const a = document.createElement("a");
  a.href = dataUrl;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  document.body.removeChild(a);
}

function captureTabDataUrl() {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage({ action: "captureTab" }, (response) => {
      if (chrome.runtime.lastError) {
        reject(new Error(chrome.runtime.lastError.message));
        return;
      }
      const dataUrl =
        typeof response === "string" ? response : response?.dataUrl;
      if (!dataUrl) {
        reject(new Error("截图失败：未获取到图像数据"));
        return;
      }
      resolve(dataUrl);
    });
  });
}

function captureTabCroppedDataUrl(width, height) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { action: "captureTabCropped", width, height },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        const dataUrl = response?.dataUrl;
        if (!dataUrl) {
          reject(
            new Error(response?.error || "裁剪截图失败：未获取到图像数据"),
          );
          return;
        }
        resolve(dataUrl);
      },
    );
  });
}

async function waitForCaptureStable(delayMs = 800) {
  // 等待当前页面字体加载完成
  if (document.fonts) {
    await document.fonts.ready;
  }
  // 强制同步布局，确保重排完成
  document.body.offsetHeight;
  // 多个 rAF 让浏览器完成绘制
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await new Promise((resolve) => requestAnimationFrame(resolve));
  // 给复杂页面足够的渲染稳定时间（含 Web Fonts、图片解码等）
  await new Promise((resolve) => setTimeout(resolve, delayMs));
  // 最终 rAF 确保截图前最后一帧已绘制
  await new Promise((resolve) => requestAnimationFrame(resolve));
}

async function waitForPreviewFrameReady() {
  const iframe = document.getElementById("previewFrame");
  if (!iframe) return;

  // 等待 iframe 加载完成（srcdoc 模式下 load 事件可靠触发）
  if (!iframe.contentDocument || iframe.contentDocument.readyState !== "complete") {
    await new Promise((resolve) => {
      iframe.addEventListener("load", resolve, { once: true });
    });
  }

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) return;

  // 等待 iframe 内字体加载完成
  if (doc.fonts) {
    await doc.fonts.ready.catch(() => {});
  }

  // 等待所有图片加载完成
  const images = Array.from(doc.querySelectorAll("img"));
  await Promise.all(
    images.map((img) => {
      return new Promise((resolve) => {
        if (img.complete) {
          resolve();
          return;
        }
        img.addEventListener("load", resolve, { once: true });
        img.addEventListener("error", resolve, { once: true });
        setTimeout(resolve, 1200);
      });
    }),
  );

  // 额外等待一帧确保绘制完成
  await new Promise((resolve) => requestAnimationFrame(resolve));
}

function enterCaptureOnlyLayout() {
  const body = document.body;
  const html = document.documentElement;
  const header = document.querySelector(".header");
  const status = document.getElementById("status");
  const modal = document.getElementById("resultModal");
  const container = document.getElementById("previewContainer");
  const wrapper = container?.querySelector(".preview-wrapper");

  const iframe = document.getElementById("previewFrame");

  const snapshot = {
    htmlStyle: html.getAttribute("style") || "",
    bodyStyle: body.getAttribute("style") || "",
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    headerDisplay: header?.style.display || "",
    statusDisplay: status?.style.display || "",
    modalDisplay: modal?.style.display || "",
    containerStyle: container?.getAttribute("style") || "",
    wrapperStyle: wrapper?.getAttribute("style") || "",
    iframeStyle: iframe?.getAttribute("style") || "",
  };

  if (header) header.style.display = "none";
  if (status) status.style.display = "none";
  if (modal) modal.style.display = "none";

  html.style.margin = "0";
  html.style.padding = "0";
  html.style.background = "#fff";
  html.style.overflow = "hidden";

  body.style.margin = "0";
  body.style.padding = "0";
  body.style.background = "#fff";
  body.style.overflow = "hidden";

  if (container) {
    container.style.position = "fixed";
    container.style.left = "0";
    container.style.top = "0";
    container.style.maxWidth = "none";
    container.style.margin = "0";
    container.style.padding = "0";
    container.style.minHeight = "0";
    container.style.borderRadius = "0";
    container.style.boxShadow = "none";
    container.style.overflow = "hidden";
    container.style.display = "block";
    container.style.width = (previewData?.width || 0) + "px";
    container.style.height = (previewData?.height || 0) + "px";
  }

  if (wrapper) {
    wrapper.style.margin = "0";
    wrapper.style.boxShadow = "none";
    wrapper.style.width = (previewData?.width || 0) + "px";
    wrapper.style.height = (previewData?.height || 0) + "px";
  }

  if (iframe) {
    iframe.style.width = (previewData?.width || 0) + "px";
    iframe.style.height = (previewData?.height || 0) + "px";
  }

  window.scrollTo(0, 0);
  return snapshot;
}

function exitCaptureOnlyLayout(snapshot) {
  if (!snapshot) return;

  const body = document.body;
  const html = document.documentElement;
  const header = document.querySelector(".header");
  const status = document.getElementById("status");
  const modal = document.getElementById("resultModal");
  const container = document.getElementById("previewContainer");
  const wrapper = container?.querySelector(".preview-wrapper");
  const iframe = document.getElementById("previewFrame");

  if (snapshot.htmlStyle) {
    html.setAttribute("style", snapshot.htmlStyle);
  } else {
    html.removeAttribute("style");
  }

  if (snapshot.bodyStyle) {
    body.setAttribute("style", snapshot.bodyStyle);
  } else {
    body.removeAttribute("style");
  }

  if (header) header.style.display = snapshot.headerDisplay;
  if (status) status.style.display = snapshot.statusDisplay;
  if (modal) modal.style.display = snapshot.modalDisplay;

  if (container) {
    if (snapshot.containerStyle) {
      container.setAttribute("style", snapshot.containerStyle);
    } else {
      container.removeAttribute("style");
    }
  }

  if (wrapper) {
    if (snapshot.wrapperStyle) {
      wrapper.setAttribute("style", snapshot.wrapperStyle);
    } else {
      wrapper.removeAttribute("style");
    }
  }

  if (iframe) {
    if (snapshot.iframeStyle) {
      iframe.setAttribute("style", snapshot.iframeStyle);
    } else {
      iframe.removeAttribute("style");
    }
  }

  window.scrollTo(snapshot.scrollX, snapshot.scrollY);
}

/**
 * 检测截图是否大面积空白
 * @param {string} dataUrl - 截图的 data URL
 * @returns {Promise<boolean>} 是否空白
 */
function isImageMostlyBlank(dataUrl) {
  return new Promise((resolve) => {
    const img = new Image();
    img.onload = () => {
      const canvas = document.createElement("canvas");
      const ctx = canvas.getContext("2d");
      const w = Math.min(img.naturalWidth, 120);
      const h = Math.min(img.naturalHeight, 120);
      canvas.width = w;
      canvas.height = h;
      ctx.drawImage(img, 0, 0, w, h);
      try {
        const imageData = ctx.getImageData(0, 0, w, h).data;
        let whitePixels = 0;
        const sampleStep = Math.max(1, Math.floor((w * h) / 16));
        let checked = 0;
        for (let i = 0; i < imageData.length; i += 4 * sampleStep) {
          const r = imageData[i];
          const g = imageData[i + 1];
          const b = imageData[i + 2];
          // 判断是否为接近白色的像素
          if (r > 245 && g > 245 && b > 245) {
            whitePixels++;
          }
          checked++;
        }
        // 如果 75% 以上采样点都是白色，认为是空白
        resolve(checked > 0 && whitePixels / checked > 0.75);
      } catch (e) {
        resolve(false);
      }
    };
    img.onerror = () => resolve(false);
    img.src = dataUrl;
  });
}

async function captureVisibleScreenshot() {
  const snapshot = enterCaptureOnlyLayout();
  try {
    await waitForCaptureStable(800);

    const width = Math.max(1, Math.ceil(previewData?.width || 0));
    const height = Math.max(1, Math.ceil(previewData?.height || 0));

    let dataUrl;
    try {
      dataUrl = await captureTabCroppedDataUrl(width, height);
    } catch (error) {
      console.warn("裁剪截图失败，回退到可视区截图:", error);
      dataUrl = await captureTabDataUrl();
    }

    // 空白检测：如果截图大面积空白，增加等待时间后重试一次
    const isBlank = await isImageMostlyBlank(dataUrl);
    if (isBlank) {
      console.warn("SmartSnapshot: 检测到空白截图，正在重试...");
      await waitForCaptureStable(1500);
      try {
        dataUrl = await captureTabCroppedDataUrl(width, height);
      } catch (error) {
        console.warn("重试裁剪截图失败，回退到可视区截图:", error);
        dataUrl = await captureTabDataUrl();
      }
    }

    return dataUrl;
  } finally {
    exitCaptureOnlyLayout(snapshot);
  }
}

async function buildScreenshotAndShowModal() {
  if (!previewData) {
    showStatus("没有可截图的内容", "error");
    return;
  }

  setActionButtonsBusy(true, getMessage('statusGenerating'));
  document.getElementById("infoText").textContent = getMessage('statusGenerating');

  try {
    await waitForPreviewFrameReady();
    const imageDataUrl = await captureVisibleScreenshot();
    lastCapturedImageDataUrl = imageDataUrl;

    document.getElementById("infoText").textContent =
      `尺寸: ${previewData.width}px × ${previewData.height}px | 文件名: ${previewData.filename}`;

    openResultModal(imageDataUrl);
    showStatus(getMessage('statusSuccess'));
  } catch (error) {
    console.error("自动截图失败:", error);
    showStatus(getMessage('statusError') + ": " + error.message, "error");
    document.getElementById("infoText").textContent =
      "截图失败，请点击“重新生成”重试";
  } finally {
    setActionButtonsBusy(false);
  }
}

async function loadPreviewData() {
  try {
    const result = await chrome.storage.local.get("previewData");
    previewData = result.previewData;

    if (!previewData) {
      document.getElementById("previewContainer").innerHTML =
        '<div class="empty">' + getMessage('previewEmpty') + '</div>';
      setActionButtonsBusy(false);
      return;
    }

    document.getElementById("infoText").textContent =
      `正在渲染：${previewData.width}px × ${previewData.height}px`;

    const container = document.getElementById("previewContainer");
    container.innerHTML = `
      <div class="preview-wrapper">
        <iframe id="previewFrame" width="${previewData.width}" height="${previewData.height}"></iframe>
      </div>
    `;

    const iframe = document.getElementById("previewFrame");
    // 使用 srcdoc 替代 doc.write()，获得更可靠的加载管线和 load 事件
    iframe.srcdoc = previewData.htmlContent;

    await buildScreenshotAndShowModal();
  } catch (error) {
    console.error("加载预览数据失败:", error);
    document.getElementById("previewContainer").innerHTML =
      '<div class="empty">加载失败: ' + error.message + "</div>";
    showStatus("加载失败: " + error.message, "error");
  }
}

function saveScreenshot() {
  if (!previewData || !lastCapturedImageDataUrl) {
    showStatus("尚未生成截图，请先重新生成", "error");
    return;
  }
  downloadDataUrl(lastCapturedImageDataUrl, previewData.filename);
  showStatus(getMessage('statusSuccess'));
}

document.getElementById("saveBtn").addEventListener("click", saveScreenshot);
document
  .getElementById("previewShotBtn")
  .addEventListener("click", buildScreenshotAndShowModal);
document
  .getElementById("closeModalBtn")
  .addEventListener("click", closeResultModal);
document
  .getElementById("regenerateBtn")
  .addEventListener("click", buildScreenshotAndShowModal);
document
  .getElementById("modalSaveBtn")
  .addEventListener("click", saveScreenshot);
document.getElementById("resultModal").addEventListener("click", (event) => {
  if (event.target.id === "resultModal") {
    closeResultModal();
  }
});

document.addEventListener("DOMContentLoaded", () => {
  applyI18n();
  setActionButtonsBusy(false);
  loadPreviewData();
});
