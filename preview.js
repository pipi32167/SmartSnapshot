let previewData = null;

// 加载预览数据
async function loadPreviewData() {
  try {
    const result = await chrome.storage.local.get("previewData");
    previewData = result.previewData;

    if (!previewData) {
      document.getElementById("previewContainer").innerHTML =
        '<div class="empty">未找到预览数据，请重新生成截图</div>';
      document.getElementById("saveBtn").disabled = true;
      return;
    }

    // 更新信息
    document.getElementById("infoText").textContent =
      `尺寸: ${previewData.width}px × ${previewData.height}px | 文件名: ${previewData.filename}`;

    // 创建预览
    const container = document.getElementById("previewContainer");
    container.innerHTML = `
      <div class="preview-wrapper">
        <iframe id="previewFrame" width="${previewData.width}" height="${previewData.height}"></iframe>
      </div>
    `;

    // 写入 HTML 内容
    const iframe = document.getElementById("previewFrame");
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(previewData.htmlContent);
    doc.close();
  } catch (error) {
    console.error("加载预览数据失败:", error);
    document.getElementById("previewContainer").innerHTML =
      '<div class="empty">加载失败: ' + error.message + "</div>";
  }
}

// 显示状态消息
function showStatus(message, type = "success") {
  const status = document.getElementById("status");
  status.textContent = message;
  status.className = "status show " + type;
  setTimeout(() => {
    status.classList.remove("show");
  }, 3000);
}

function enterCaptureOnlyLayout() {
  const body = document.body;
  const html = document.documentElement;
  const header = document.querySelector(".header");
  const status = document.getElementById("status");
  const container = document.getElementById("previewContainer");
  const wrapper = container?.querySelector(".preview-wrapper");

  const snapshot = {
    htmlStyle: html.getAttribute("style") || "",
    bodyStyle: body.getAttribute("style") || "",
    scrollX: window.scrollX,
    scrollY: window.scrollY,
    headerDisplay: header?.style.display || "",
    statusDisplay: status?.style.display || "",
    containerStyle: container?.getAttribute("style") || "",
    wrapperStyle: wrapper?.getAttribute("style") || "",
  };

  if (header) header.style.display = "none";
  if (status) status.style.display = "none";

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

async function waitForCaptureStable() {
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await new Promise((resolve) => requestAnimationFrame(resolve));
  await new Promise((resolve) => setTimeout(resolve, 120));
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

async function captureVisibleScreenshot() {
  const snapshot = enterCaptureOnlyLayout();
  try {
    await waitForCaptureStable();

    const width = Math.max(1, Math.ceil(previewData?.width || 0));
    const height = Math.max(1, Math.ceil(previewData?.height || 0));

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

function setActionButtonsBusy(isBusy, label = "生成中...") {
  const saveBtn = document.getElementById("saveBtn");
  const previewBtn = document.getElementById("previewShotBtn");

  if (saveBtn) {
    saveBtn.textContent = isBusy ? label : "💾 保存截图";
    saveBtn.disabled = isBusy;
  }
  if (previewBtn) {
    previewBtn.textContent = isBusy ? label : "👁️ 预览截图";
    previewBtn.disabled = isBusy;
  }
}

// 在新页面中预览最终截图
async function previewScreenshot() {
  if (!previewData) {
    showStatus("没有可预览的内容", "error");
    return;
  }

  setActionButtonsBusy(true, "生成预览中...");

  try {
    const imageDataUrl = await captureVisibleScreenshot();
    const win = window.open("", "_blank");

    if (!win) {
      throw new Error("浏览器阻止了新窗口，请允许弹窗后重试");
    }

    win.document.open();
    win.document.write(`
      <!doctype html>
      <html>
      <head>
        <meta charset="utf-8">
        <title>SmartSnapshot 截图预览</title>
        <style>
          body { margin: 0; padding: 20px; background: #f5f5f5; font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; }
          .wrap { max-width: 1200px; margin: 0 auto; }
          .title { margin: 0 0 12px; color: #333; font-size: 18px; }
          .meta { margin: 0 0 16px; color: #666; font-size: 13px; }
          img { display: block; max-width: 100%; height: auto; background: #fff; box-shadow: 0 4px 20px rgba(0,0,0,0.15); }
        </style>
      </head>
      <body>
        <div class="wrap">
          <h1 class="title">SmartSnapshot 截图预览</h1>
          <p class="meta">${previewData.filename} · ${previewData.width} × ${previewData.height}</p>
          <img src="${imageDataUrl}" alt="SmartSnapshot Preview" />
        </div>
      </body>
      </html>
    `);
    win.document.close();

    showStatus("已在新页面打开截图预览");
  } catch (error) {
    console.error("预览失败:", error);
    showStatus("预览失败: " + error.message, "error");
  } finally {
    setActionButtonsBusy(false);
  }
}

// 保存截图
async function saveScreenshot() {
  if (!previewData) {
    showStatus("没有可保存的内容", "error");
    return;
  }

  setActionButtonsBusy(true, "生成中...");

  try {
    const imageDataUrl = await captureVisibleScreenshot();

    const a = document.createElement("a");
    a.href = imageDataUrl;
    a.download = previewData.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    showStatus("截图已保存");
  } catch (error) {
    console.error("保存失败:", error);
    showStatus("保存失败: " + error.message, "error");
  } finally {
    setActionButtonsBusy(false);
  }
}

// 绑定事件
document.getElementById("saveBtn").addEventListener("click", saveScreenshot);
document
  .getElementById("previewShotBtn")
  .addEventListener("click", previewScreenshot);

// 页面加载完成后加载数据
document.addEventListener("DOMContentLoaded", loadPreviewData);
