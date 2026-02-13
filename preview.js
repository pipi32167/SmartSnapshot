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

function pinRuntimeImageSource(doc) {
  const images = Array.from(doc.querySelectorAll("img"));
  images.forEach((img) => {
    const runtimeSrc = img.currentSrc || img.src;
    if (runtimeSrc) {
      img.src = runtimeSrc;
      img.removeAttribute("srcset");
    }
    img.removeAttribute("loading");
    img.setAttribute("decoding", "sync");
    img.setAttribute("fetchpriority", "high");
  });
}

async function inlineImagesAsBlobUrls(doc) {
  const images = Array.from(doc.querySelectorAll("img"));
  const blobUrls = [];

  await Promise.all(
    images.map(async (img) => {
      const src = img.currentSrc || img.src;
      if (!src || src.startsWith("data:") || src.startsWith("blob:")) {
        return;
      }

      try {
        const response = await fetch(src, {
          method: "GET",
          credentials: "omit",
          cache: "force-cache",
        });
        if (!response.ok) return;

        const blob = await response.blob();
        if (!blob.type.startsWith("image/")) return;

        const blobUrl = URL.createObjectURL(blob);
        blobUrls.push(blobUrl);

        img.src = blobUrl;
        img.removeAttribute("srcset");
      } catch (e) {
        // 静默失败：保留原始地址
      }
    }),
  );

  return () => {
    blobUrls.forEach((url) => URL.revokeObjectURL(url));
  };
}

async function waitForImagesReady(doc) {
  const images = Array.from(doc.querySelectorAll("img"));
  await Promise.all(
    images.map((img) => {
      return new Promise((resolve) => {
        if (img.complete && img.naturalWidth > 0) {
          if (typeof img.decode === "function") {
            img
              .decode()
              .catch(() => {})
              .finally(resolve);
          } else {
            resolve();
          }
          return;
        }

        const onLoad = () => {
          cleanup();
          resolve();
        };
        const onError = () => {
          cleanup();
          resolve();
        };
        const cleanup = () => {
          img.removeEventListener("load", onLoad);
          img.removeEventListener("error", onError);
        };

        img.addEventListener("load", onLoad);
        img.addEventListener("error", onError);
        setTimeout(() => {
          cleanup();
          resolve();
        }, 4000);
      });
    }),
  );
}

/**
 * 渲染截图为 canvas（供预览和保存复用）
 */
async function renderScreenshotCanvas() {
  if (!previewData) {
    throw new Error("没有可导出的内容");
  }

  const iframe = document.getElementById("previewFrame");
  const doc = iframe.contentDocument || iframe.contentWindow.document;

  pinRuntimeImageSource(doc);

  let cleanupBlobUrls = () => {};
  cleanupBlobUrls = await inlineImagesAsBlobUrls(doc);

  await waitForImagesReady(doc);

  await new Promise((r) => setTimeout(r, 500));

  const container = doc.querySelector(".smartsnapshot-container");
  if (!container) {
    throw new Error("未找到内容容器");
  }

  try {
    try {
      return await html2canvas(container, {
        scale: 2,
        backgroundColor: "#ffffff",
        logging: false,
        useCORS: true,
        allowTaint: true,
        imageTimeout: 10000,
        foreignObjectRendering: false,
        scrollX: 0,
        scrollY: 0,
      });
    } catch (e) {
      return await html2canvas(container, {
        scale: 2,
        backgroundColor: "#ffffff",
        logging: false,
        useCORS: true,
        allowTaint: true,
        imageTimeout: 10000,
        foreignObjectRendering: true,
        scrollX: 0,
        scrollY: 0,
      });
    }
  } finally {
    cleanupBlobUrls();
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
    const canvas = await renderScreenshotCanvas();
    const imageDataUrl = canvas.toDataURL("image/png");
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
    const canvas = await renderScreenshotCanvas();

    // 转换为 blob 并下载
    const blob = await new Promise((resolve) =>
      canvas.toBlob(resolve, "image/png"),
    );
    const url = URL.createObjectURL(blob);

    const a = document.createElement("a");
    a.href = url;
    a.download = previewData.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);

    URL.revokeObjectURL(url);
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
