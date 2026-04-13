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
  // Keep the screenshot at its real output width so preview does not stretch.
  const outputWidth = Math.ceil(previewData?.width || 0);
  image.style.width = outputWidth > 0 ? outputWidth + "px" : "";
  image.style.height = "auto";
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

function captureTabCroppedSegmentDataUrl(x, y, width, height) {
  return new Promise((resolve, reject) => {
    chrome.runtime.sendMessage(
      { action: "captureTabCroppedSegment", x, y, width, height },
      (response) => {
        if (chrome.runtime.lastError) {
          reject(new Error(chrome.runtime.lastError.message));
          return;
        }
        const dataUrl = response?.dataUrl;
        if (!dataUrl) {
          reject(
            new Error(response?.error || "分段截图失败：未获取到图像数据"),
          );
          return;
        }
        resolve({ dataUrl });
      },
    );
  });
}

function loadImage(dataUrl) {
  return new Promise((resolve, reject) => {
    const image = new Image();
    image.onload = () => resolve(image);
    image.onerror = () => reject(new Error("图像解码失败"));
    image.src = dataUrl;
  });
}

function getImageSignature(image, sx, sy, sw, sh) {
  const sample = document.createElement("canvas");
  sample.width = 16;
  sample.height = 16;
  const sampleCtx = sample.getContext("2d");
  if (!sampleCtx) return "";

  sampleCtx.drawImage(image, sx, sy, sw, sh, 0, 0, 16, 16);
  const pixels = sampleCtx.getImageData(0, 0, 16, 16).data;
  let hash = 2166136261;
  for (let i = 0; i < pixels.length; i += 4) {
    hash ^= pixels[i];
    hash = (hash * 16777619) >>> 0;
    hash ^= pixels[i + 1];
    hash = (hash * 16777619) >>> 0;
    hash ^= pixels[i + 2];
    hash = (hash * 16777619) >>> 0;
  }
  return hash.toString(16);
}

async function captureSegmentWithRetry(x, y, width, height, previousSignature) {
  const MAX_RETRY = 2;
  let lastAttempt = null;

  for (let attempt = 0; attempt <= MAX_RETRY; attempt += 1) {
    const segment = await captureTabCroppedSegmentDataUrl(x, y, width, height);
    const segmentImage = await loadImage(segment.dataUrl);
    const signature = getImageSignature(
      segmentImage,
      0,
      0,
      segmentImage.naturalWidth || segmentImage.width,
      segmentImage.naturalHeight || segmentImage.height,
    );

    const naturalWidth = segmentImage.naturalWidth || segmentImage.width;
    const naturalHeight = segmentImage.naturalHeight || segmentImage.height;
    const result = {
      segmentImage,
      signature,
      ratioX: naturalWidth / width,
      ratioY: naturalHeight / height,
    };

    if (signature !== previousSignature || !previousSignature || y === 0) {
      return result;
    }

    lastAttempt = result;

    // 出现疑似重复段时重试，避免偶发的错误帧被拼接进结果。
    await new Promise((resolve) => setTimeout(resolve, 80));
  }

  // 有些页面会出现连续完全一致的区块，此时不再硬失败，直接接收最后一次结果。
  console.warn(`Segment may be duplicated but accepted, y=${y}`);
  if (lastAttempt) {
    return lastAttempt;
  }
  throw new Error(`分段截图失败，y=${y}`);
}

async function captureScreenshotBySegments(width, height) {
  const TILE_HEIGHT = 1200;
  const OVERLAP = 64;
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const ctx = canvas.getContext("2d");

  if (!ctx) {
    throw new Error("无法创建截图画布");
  }

  let previousSignature = "";
  for (let outputY = 0; outputY < height; outputY += TILE_HEIGHT) {
    const drawHeight = Math.min(TILE_HEIGHT, height - outputY);
    const extraTop = outputY > 0 ? OVERLAP : 0;
    const extraBottom = outputY + drawHeight < height ? OVERLAP : 0;
    const requestY = Math.max(0, outputY - extraTop);
    const requestHeight = Math.min(
      height - requestY,
      drawHeight + extraTop + extraBottom,
    );
    const sourceY = outputY - requestY;

    const { segmentImage, signature, ratioX, ratioY } =
      await captureSegmentWithRetry(
      0,
      requestY,
      width,
      requestHeight,
      previousSignature,
    );

    const sourceXInImage = 0;
    const sourceYInImage = Math.round(sourceY * ratioY);
    const sourceWInImage = Math.min(
      segmentImage.naturalWidth || segmentImage.width,
      Math.round(width * ratioX),
    );
    const sourceHInImage = Math.min(
      (segmentImage.naturalHeight || segmentImage.height) - sourceYInImage,
      Math.round(drawHeight * ratioY),
    );
    if (sourceWInImage <= 0 || sourceHInImage <= 0) {
      throw new Error(
        `分段像素尺寸异常，y=${outputY}, src=${sourceWInImage}x${sourceHInImage}`,
      );
    }

    // 分段带重叠，拼接时只取中间有效区域，降低接缝与重复风险。
    ctx.drawImage(
      segmentImage,
      sourceXInImage,
      sourceYInImage,
      sourceWInImage,
      sourceHInImage,
      0,
      outputY,
      width,
      drawHeight,
    );
    previousSignature = signature;
  }

  return canvas.toDataURL("image/png");
}

async function waitForCaptureStable() {
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await new Promise((resolve) => setTimeout(resolve, 120));
}

async function waitForPreviewFrameReady() {
  const iframe = document.getElementById("previewFrame");
  if (!iframe) return;

  const doc = iframe.contentDocument || iframe.contentWindow?.document;
  if (!doc) return;

  if (doc.readyState !== "complete") {
    await new Promise((resolve) => {
      iframe.addEventListener("load", resolve, { once: true });
    });
  }

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
}

function enterCaptureOnlyLayout() {
  const body = document.body;
  const html = document.documentElement;
  const header = document.querySelector(".header");
  const status = document.getElementById("status");
  const modal = document.getElementById("resultModal");
  const container = document.getElementById("previewContainer");
  const wrapper = container?.querySelector(".preview-wrapper");

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

  const iframe = document.getElementById("previewFrame");
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

  window.scrollTo(snapshot.scrollX, snapshot.scrollY);
}

async function captureVisibleScreenshot() {
  const snapshot = enterCaptureOnlyLayout();
  try {
    await waitForCaptureStable();

    const width = Math.max(1, Math.ceil(previewData?.width || 0));
    const height = Math.max(1, Math.ceil(previewData?.height || 0));

    if (height > 3000) {
      try {
        return await captureScreenshotBySegments(width, height);
      } catch (segmentError) {
        console.warn("分段截图失败，回退到裁剪截图:", segmentError);
      }
    }

    try {
      return await captureTabCroppedDataUrl(width, height);
    } catch (error) {
      console.warn("裁剪截图失败，回退到可视区截图:", error);
      return await captureTabDataUrl();
    }
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
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(previewData.htmlContent);
    doc.close();

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
