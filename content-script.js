/**
 * SmartSnapshot Content Script
 * Handles element selection, sidebar, preview, and screenshot functionality
 */

(function () {
  "use strict";

  const state = {
    isActive: false,
    hoveredElement: null,
    selectedElements: new Set(),
    highlightedElements: new Set(),
    currentDomain: "",
    sidebar: null,
    previewContainer: null,
    isProcessing: false,
  };

  const SELECTED_CLASS = "smartsnapshot-selected";
  const HOVER_CLASS = "smartsnapshot-hover";
  const SIDEBAR_ID = "smartsnapshot-sidebar";
  const PREVIEW_CONTAINER_ID = "smartsnapshot-preview";

  /**
   * Get localized message
   * @param {string} key - Message key
   * @param {string[]} [args] - Substitution arguments
   * @returns {string} Localized message
   */
  function getMessage(key, args) {
    if (
      typeof chrome !== "undefined" &&
      chrome.i18n &&
      chrome.i18n.getMessage
    ) {
      return chrome.i18n.getMessage(key, args);
    }
    // Fallback messages
    const fallbacks = {
      emptyHint: "点击页面元素开始选择",
      btnSave: "保存选择",
      btnForget: "忘记",
      btnScreenshot: "📷 截图",
      btnScreenshotProcessing: "处理中...",
      btnMarkdown: "📝 Markdown",
      notificationCopied: "已复制到剪贴板",
      notificationCopyFailed: "复制失败",
      notificationPreviewFailed: "预览打开失败",
      notificationSaved: "选择已保存",
      notificationSaveFailed: "保存失败",
      notificationForgotten: "已忘记此域名的选择",
      notificationPreviewOpened: "预览页面已打开",
      notificationPreviewFailed: "预览打开失败",
      notificationScreenshotFailed: "截图失败",
      elementCount: `${args?.[0] || 0} 个元素`,
    };
    return fallbacks[key] || key;
  }

  function init() {
    chrome.runtime.onMessage.addListener(handleMessage);
    document.addEventListener("keydown", handleKeyDown);
  }

  function handleMessage(request, sender, sendResponse) {
    if (request.action === "startSelection") {
      startSelection(request.domain);
      sendResponse({ success: true });
    } else if (request.action === "stopSelection") {
      stopSelection();
      sendResponse({ success: true });
    }
    return false;
  }

  function handleKeyDown(e) {
    if (e.key === "Escape" && state.isActive) {
      stopSelection();
    }
  }

  async function startSelection(domain) {
    if (state.isActive) return;
    state.isActive = true;
    state.currentDomain = domain;
    createSidebar();
    await loadSavedSelections();
    document.addEventListener("mousemove", handleMouseMove, { passive: true });
    document.addEventListener("click", handleClick, true);
    document.body.style.userSelect = "none";
  }

  function stopSelection() {
    if (!state.isActive) return;
    state.isActive = false;
    document.removeEventListener("mousemove", handleMouseMove, {
      passive: true,
    });
    document.removeEventListener("click", handleClick, true);
    removeHoverEffect();
    removeSidebar();
    document.body.style.userSelect = "";
    clearHighlights();
    chrome.runtime.sendMessage({ action: "selectionStopped" });
  }

  function createSidebar() {
    if (document.getElementById(SIDEBAR_ID)) return;
    const sidebar = document.createElement("div");
    sidebar.id = SIDEBAR_ID;
    sidebar.innerHTML = `
      <div class="smartsnapshot-header">
        <h3>SmartSnapshot</h3>
        <span class="smartsnapshot-domain">${state.currentDomain}</span>
      </div>
      <div class="smartsnapshot-preview-wrapper">
        <div id="${PREVIEW_CONTAINER_ID}">
          <div class="smartsnapshot-empty">${getMessage("emptyHint")}</div>
        </div>
      </div>
      <div class="smartsnapshot-footer">
        <div class="smartsnapshot-actions">
          <button id="smartsnapshot-save" class="smartsnapshot-btn smartsnapshot-btn-primary" disabled>${getMessage("btnSave")}</button>
          <button id="smartsnapshot-forget" class="smartsnapshot-btn smartsnapshot-btn-secondary" disabled>${getMessage("btnForget")}</button>
        </div>
        <div class="smartsnapshot-actions-secondary">
          <button id="smartsnapshot-screenshot" class="smartsnapshot-btn smartsnapshot-btn-screenshot" disabled>${getMessage("btnScreenshot")}</button>
          <button id="smartsnapshot-markdown" class="smartsnapshot-btn smartsnapshot-btn-markdown" disabled>${getMessage("btnMarkdown")}</button>
        </div>
      </div>
    `;
    document.body.appendChild(sidebar);
    state.sidebar = sidebar;
    state.previewContainer = document.getElementById(PREVIEW_CONTAINER_ID);
    bindSidebarEvents();
    document.body.style.marginRight = "450px";
  }

  function bindSidebarEvents() {
    document
      .getElementById("smartsnapshot-save")
      ?.addEventListener("click", saveSelections);
    document
      .getElementById("smartsnapshot-forget")
      ?.addEventListener("click", forgetSelections);
    document
      .getElementById("smartsnapshot-screenshot")
      ?.addEventListener("click", takeScreenshot);
    document
      .getElementById("smartsnapshot-markdown")
      ?.addEventListener("click", showMarkdown);
  }

  function removeSidebar() {
    document.getElementById(SIDEBAR_ID)?.remove();
    state.sidebar = null;
    state.previewContainer = null;
    document.body.style.marginRight = "";
  }

  function handleMouseMove(e) {
    if (!state.isActive || state.isProcessing) return;
    const target = document.elementFromPoint(e.clientX, e.clientY);
    if (!target || target.closest(`#${SIDEBAR_ID}`)) {
      removeHoverEffect();
      return;
    }
    if (isDescendantOfSelected(target)) {
      removeHoverEffect();
      return;
    }
    if (target !== state.hoveredElement) {
      removeHoverEffect();
      state.hoveredElement = target;
      addHoverEffect(target);
    }
  }

  function handleClick(e) {
    if (!state.isActive) return;
    const target = e.target;
    if (target.closest(`#${SIDEBAR_ID}`)) return;
    e.preventDefault();
    e.stopPropagation();
    if (state.selectedElements.has(target)) {
      deselectElement(target);
    } else if (!isDescendantOfSelected(target)) {
      selectElement(target);
    }
    updatePreview();
    updateButtons();
  }

  function addHoverEffect(element) {
    if (!element || element.classList.contains(SELECTED_CLASS)) return;
    element.classList.add(HOVER_CLASS);
    const rect = element.getBoundingClientRect();
    const label = document.createElement("div");
    label.className = "smartsnapshot-hover-label";
    label.textContent =
      element.tagName.toLowerCase() + (element.id ? "#" + element.id : "");
    label.style.cssText = `position:fixed;top:${rect.top}px;left:${rect.left}px;z-index:2147483647;background:#1a73e8;color:white;padding:2px 8px;font-size:11px;font-family:monospace;border-radius:2px;pointer-events:none;`;
    document.body.appendChild(label);
    element._hoverLabel = label;
  }

  function removeHoverEffect() {
    document
      .querySelectorAll(`.${HOVER_CLASS}`)
      .forEach((el) => el.classList.remove(HOVER_CLASS));
    if (state.hoveredElement) {
      state.hoveredElement.classList.remove(HOVER_CLASS);
      state.hoveredElement = null;
    }
    document
      .querySelectorAll(".smartsnapshot-hover-label")
      .forEach((l) => l.remove());
  }

  function escapeHtml(text) {
    const div = document.createElement("div");
    div.textContent = text;
    return div.innerHTML;
  }

  function isDescendantOfSelected(element) {
    for (const selected of state.selectedElements) {
      if (selected.contains(element) && selected !== element) return true;
    }
    return false;
  }

  function selectElement(element) {
    const toRemove = [];
    for (const selected of state.selectedElements) {
      if (element.contains(selected) && element !== selected)
        toRemove.push(selected);
    }
    toRemove.forEach((el) => deselectElement(el));
    state.selectedElements.add(element);
    element.classList.add(SELECTED_CLASS);
  }

  function deselectElement(element) {
    state.selectedElements.delete(element);
    element.classList.remove(SELECTED_CLASS);
  }

  function clearHighlights() {
    state.selectedElements.forEach((el) => el.classList.remove(SELECTED_CLASS));
    state.selectedElements.clear();
    removeHoverEffect();
  }

  function getUniqueSelector(element) {
    if (element.id) return "#" + element.id;
    const path = [];
    let current = element;
    while (current && current !== document.body) {
      let selector = current.tagName.toLowerCase();
      if (current.id) {
        selector += "#" + current.id;
        path.unshift(selector);
        break;
      }
      if (current.className && typeof current.className === "string") {
        const classes = current.className
          .split(" ")
          .filter((c) => c && !c.startsWith("smartsnapshot-"))
          .slice(0, 2);
        if (classes.length > 0) selector += "." + classes.join(".");
      }
      const siblings = Array.from(current.parentNode?.children || []);
      const sameTagSiblings = siblings.filter(
        (s) => s.tagName === current.tagName,
      );
      if (sameTagSiblings.length > 1) {
        const index = siblings.indexOf(current) + 1;
        selector += ":nth-child(" + index + ")";
      }
      path.unshift(selector);
      current = current.parentNode;
      if (path.length > 5) break;
    }
    return path.join(" > ");
  }

  async function loadSavedSelections() {
    try {
      const result = await chrome.storage.local.get(state.currentDomain);
      const savedSelectors = result[state.currentDomain];
      if (savedSelectors && Array.isArray(savedSelectors)) {
        savedSelectors.forEach((selector) => {
          try {
            document.querySelectorAll(selector).forEach((el) => {
              if (el && !isDescendantOfSelected(el)) {
                selectElement(el);
                state.highlightedElements.add(el);
              }
            });
          } catch (e) {
            console.warn("SmartSnapshot: Failed to load saved selector", e);
          }
        });
        if (state.selectedElements.size > 0) {
          updatePreview();
          updateButtons();
        }
      }
    } catch (error) {
      console.warn("SmartSnapshot: Failed to load saved selections", error);
    }
  }

  async function saveSelections() {
    if (state.selectedElements.size === 0) return;
    const selectors = [];
    state.selectedElements.forEach((element) => {
      const selector = getUniqueSelector(element);
      if (selector) selectors.push(selector);
    });
    try {
      await chrome.storage.local.set({ [state.currentDomain]: selectors });
      showNotification(getMessage("notificationSaved"));
    } catch (error) {
      showNotification(getMessage("notificationSaveFailed"), "error");
    }
  }

  async function forgetSelections() {
    try {
      await chrome.storage.local.remove(state.currentDomain);
      clearHighlights();
      updatePreview();
      updateButtons();
      showNotification(getMessage("notificationForgotten"));
    } catch (error) {
      console.warn("SmartSnapshot: Failed to forget selections", error);
    }
  }

  /**
   * 等待 iframe 中的资源加载完成
   */
  function waitForResources(doc) {
    return new Promise((resolve) => {
      const images = Array.from(doc.querySelectorAll("img"));
      const promises = images.map((img) => {
        return new Promise((resolveImg) => {
          if (img.complete) {
            resolveImg();
          } else {
            img.onload = resolveImg;
            img.onerror = resolveImg;
            setTimeout(resolveImg, 1000); // 超时
          }
        });
      });

      Promise.all(promises).then(() => setTimeout(resolve, 300));
    });
  }

  /**
   * 获取元素的完整样式表
   */
  function extractStyles() {
    let css = "";
    const baseUrl = window.location.href;

    try {
      for (const sheet of document.styleSheets) {
        try {
          for (const rule of sheet.cssRules) {
            let cssText = rule.cssText;
            // 将 CSS 中的相对 URL 转换为绝对 URL
            cssText = cssText.replace(
              /url\(['"]?([^'"\)]+)['"]?\)/g,
              (match, url) => {
                if (
                  url.startsWith("data:") ||
                  url.startsWith("http://") ||
                  url.startsWith("https://") ||
                  url.startsWith("//")
                ) {
                  return match;
                }
                try {
                  return 'url("' + new URL(url, baseUrl).href + '")';
                } catch (e) {
                  return match;
                }
              },
            );
            css += cssText + "\n";
          }
        } catch (e) {
          // 跨域样式表无法访问，尝试通过 ownerNode 获取
          try {
            if (sheet.ownerNode && sheet.ownerNode.textContent) {
              let text = sheet.ownerNode.textContent;
              // 也转换这些样式中的 URL
              text = text.replace(
                /url\(['"]?([^'"\)]+)['"]?\)/g,
                (match, url) => {
                  if (
                    url.startsWith("data:") ||
                    url.startsWith("http://") ||
                    url.startsWith("https://") ||
                    url.startsWith("//")
                  ) {
                    return match;
                  }
                  try {
                    return 'url("' + new URL(url, baseUrl).href + '")';
                  } catch (e) {
                    return match;
                  }
                },
              );
              css += text + "\n";
            }
          } catch (err) {}
        }
      }
    } catch (e) {}

    // 添加关键的内联样式规则（避免覆盖站点自身 img 布局）
    css += `
      svg { display: inline-block; }
      * { word-wrap: break-word; }
    `;

    return css;
  }

  /**
   * 深度克隆元素并修复资源路径
   */
  function cloneForExport(element) {
    const clone = element.cloneNode(true);
    const baseUrl = window.location.href;
    function getImagesIncludingRoot(root) {
      const images = [];
      if (root.tagName === "IMG") images.push(root);
      images.push(...Array.from(root.querySelectorAll("img")));
      return images;
    }

    const originalImages = getImagesIncludingRoot(element);
    const clonedImages = getImagesIncludingRoot(clone);

    function copyCriticalImageStyles(sourceImg, targetImg) {
      if (!sourceImg || !targetImg) return;
      const computed = window.getComputedStyle(sourceImg);
      const criticalProps = [
        "display",
        "width",
        "height",
        "min-width",
        "min-height",
        "max-width",
        "max-height",
        "object-fit",
        "object-position",
        "border-radius",
        "aspect-ratio",
        "vertical-align",
        "transform",
        "transform-origin",
        "clip-path",
        "mask-image",
        "mask-size",
        "mask-position",
        "mask-repeat",
        "-webkit-mask-image",
        "-webkit-mask-size",
        "-webkit-mask-position",
        "-webkit-mask-repeat",
      ];

      criticalProps.forEach((prop) => {
        const value = computed.getPropertyValue(prop);
        if (value) {
          targetImg.style.setProperty(
            prop,
            value,
            computed.getPropertyPriority(prop),
          );
        }
      });
    }

    function copyAvatarContainerStyles(
      sourceImg,
      targetImg,
      sourceRoot,
      targetRoot,
    ) {
      const props = [
        "position",
        "top",
        "right",
        "bottom",
        "left",
        "inset",
        "display",
        "width",
        "height",
        "min-width",
        "min-height",
        "max-width",
        "max-height",
        "border-radius",
        "overflow",
        "overflow-x",
        "overflow-y",
        "box-sizing",
        "padding",
        "margin",
        "align-items",
        "justify-content",
        "transform",
        "transform-origin",
        "clip-path",
        "mask-image",
        "mask-size",
        "mask-position",
        "mask-repeat",
        "-webkit-mask-image",
        "-webkit-mask-size",
        "-webkit-mask-position",
        "-webkit-mask-repeat",
      ];

      let src = sourceImg?.parentElement;
      let dst = targetImg?.parentElement;
      let level = 0;

      while (
        src &&
        dst &&
        level < 4 &&
        sourceRoot.contains(src) &&
        targetRoot.contains(dst)
      ) {
        const computed = window.getComputedStyle(src);
        const shouldCopy =
          computed.borderRadius !== "0px" ||
          computed.overflow !== "visible" ||
          computed.position !== "static" ||
          computed.display.includes("flex") ||
          computed.display === "grid";

        if (shouldCopy) {
          props.forEach((prop) => {
            const value = computed.getPropertyValue(prop);
            if (value) {
              dst.style.setProperty(
                prop,
                value,
                computed.getPropertyPriority(prop),
              );
            }
          });
        }

        src = src.parentElement;
        dst = dst.parentElement;
        level++;
      }
    }

    // 修复图片路径 - 使用 getAttribute 获取原始值
    clonedImages.forEach((img, index) => {
      const originalImg = originalImages[index];

      // 移除懒加载，确保图片立即加载
      img.removeAttribute("loading");

      // 优先使用运行时实际生效的图片地址（currentSrc）
      const runtimeSrc = originalImg?.currentSrc || originalImg?.src;
      const rawSrc = img.getAttribute("src");
      const src = runtimeSrc || rawSrc;
      if (src && !src.startsWith("data:")) {
        try {
          img.src = new URL(src, baseUrl).href;
        } catch (e) {}
      }

      // 处理 srcset
      const srcset =
        originalImg?.getAttribute("srcset") || img.getAttribute("srcset");
      if (srcset) {
        try {
          const newSrcset = srcset
            .split(",")
            .map((part) => {
              const [url, descriptor] = part.trim().split(/\s+/);
              return (
                new URL(url, baseUrl).href +
                (descriptor ? " " + descriptor : "")
              );
            })
            .join(", ");
          img.setAttribute("srcset", newSrcset);
        } catch (e) {}
      }

      // 锁定当前选择的资源，避免 iframe 环境重新挑选错误候选图
      if (runtimeSrc) {
        img.removeAttribute("srcset");
      }

      // 保留关键计算样式，修复头像等图片在导出中的错位/裁切
      copyCriticalImageStyles(originalImg, img);
      copyAvatarContainerStyles(originalImg, img, element, clone);
    });

    // 处理 picture 元素中的 source
    clone.querySelectorAll("source").forEach((source) => {
      const srcset = source.getAttribute("srcset");
      if (srcset) {
        try {
          const newSrcset = srcset
            .split(",")
            .map((part) => {
              const [url, descriptor] = part.trim().split(/\s+/);
              return (
                new URL(url, baseUrl).href +
                (descriptor ? " " + descriptor : "")
              );
            })
            .join(", ");
          source.setAttribute("srcset", newSrcset);
        } catch (e) {}
      }
    });

    // 修复背景图片
    clone.querySelectorAll("*").forEach((el) => {
      const style = el.getAttribute("style") || "";
      if (style.includes("url(")) {
        const fixedStyle = style.replace(
          /url\(['"]?([^'"\)]+)['"]?\)/g,
          (match, url) => {
            try {
              return 'url("' + new URL(url, baseUrl).href + '")';
            } catch (e) {
              return match;
            }
          },
        );
        el.setAttribute("style", fixedStyle);
      }
    });

    // 移除事件处理器和脚本
    clone.querySelectorAll("script").forEach((s) => s.remove());
    clone.querySelectorAll("*").forEach((el) => {
      const attrs = el.attributes;
      for (let i = attrs.length - 1; i >= 0; i--) {
        const attr = attrs[i];
        if (attr.name.startsWith("on")) {
          el.removeAttribute(attr.name);
        }
      }
    });

    return clone;
  }

  function updatePreview() {
    if (!state.previewContainer) return;
    if (state.selectedElements.size === 0) {
      state.previewContainer.innerHTML =
        '<div class="smartsnapshot-empty">点击页面元素开始选择</div>';
      return;
    }

    const selectedArray = Array.from(state.selectedElements);

    // 计算边界
    let minX = Infinity,
      minY = Infinity,
      maxX = 0,
      maxY = 0;
    selectedArray.forEach((el) => {
      const rect = el.getBoundingClientRect();
      const sx = window.scrollX,
        sy = window.scrollY;
      minX = Math.min(minX, rect.left + sx);
      minY = Math.min(minY, rect.top + sy);
      maxX = Math.max(maxX, rect.right + sx);
      maxY = Math.max(maxY, rect.bottom + sy);
    });

    const padding = 20;
    minX -= padding;
    minY -= padding;
    maxX += padding;
    maxY += padding;
    const totalW = maxX - minX,
      totalH = maxY - minY;

    // 计算缩放 - 使用更大的预览区域，设置最小缩放比例
    const containerW = 400,
      containerH = 500;
    const minScale = 0.4; // 最小缩放比例，防止预览太小
    let scale = Math.min(containerW / totalW, containerH / totalH, 1);
    scale = Math.max(scale, minScale); // 确保至少 minScale 的缩放

    // 创建包装器
    const wrapper = document.createElement("div");
    wrapper.className =
      "smartsnapshot-preview-item smartsnapshot-preview-merged";

    const tags = selectedArray
      .map((el) => el.tagName.toLowerCase() + (el.id ? "#" + el.id : ""))
      .join(", ");
    wrapper.innerHTML = `
      <div class="smartsnapshot-preview-header">
        <span title="${tags}">${getMessage("elementCount", [selectedArray.length])}</span>
        <div class="smartsnapshot-preview-actions">
          ${selectedArray.map((el, i) => `<button class="smartsnapshot-remove-item" data-index="${i}">${escapeHtml(el.tagName.toLowerCase())} ✕</button>`).join("")}
        </div>
      </div>
      <div class="smartsnapshot-preview-content">
        <iframe class="smartsnapshot-preview-iframe" sandbox="allow-same-origin"></iframe>
      </div>
    `;

    const iframe = wrapper.querySelector("iframe");
    const css = extractStyles();

    // 获取页面根元素的计算样式用于字体继承
    const rootStyle = window.getComputedStyle(document.body);
    const baseFontFamily =
      rootStyle.fontFamily || "-apple-system, BlinkMacSystemFont, sans-serif";
    const baseFontSize = rootStyle.fontSize || "16px";
    const baseLineHeight = rootStyle.lineHeight || "normal";

    // 构建 HTML 内容
    const htmlContent = `
      <!DOCTYPE html>
      <html>
      <head>
        <meta charset="UTF-8">
        <style>
          * { margin: 0; padding: 0; box-sizing: border-box; }
          html {
            font-family: ${escapeHtml(baseFontFamily)};
            font-size: ${escapeHtml(baseFontSize)};
            line-height: ${escapeHtml(baseLineHeight)};
            -webkit-font-smoothing: antialiased;
            -moz-osx-font-smoothing: grayscale;
          }
          body { 
            background: white; 
            overflow: hidden;
            width: ${totalW}px;
            height: ${totalH}px;
            font-family: inherit;
            font-size: inherit;
            line-height: inherit;
          }
          .smartsnapshot-container {
            position: relative;
            width: ${totalW}px;
            height: ${totalH}px;
            transform: scale(${scale});
            transform-origin: top left;
          }
          .smartsnapshot-element-wrapper {
            position: absolute;
            outline: 1px solid rgba(26, 115, 232, 0.5);
          }
          ${css}
        </style>
      </head>
      <body>
        <div class="smartsnapshot-container">
          ${selectedArray
            .map((el) => {
              const rect = el.getBoundingClientRect();
              const sx = window.scrollX,
                sy = window.scrollY;
              const left = rect.left + sx - minX;
              const top = rect.top + sy - minY;
              const clone = cloneForExport(el);
              return `<div class="smartsnapshot-element-wrapper" style="left:${left}px;top:${top}px;width:${rect.width}px;height:${rect.height}px;overflow:visible;">${clone.outerHTML}</div>`;
            })
            .join("")}
        </div>
      </body>
      </html>
    `;

    // 使用 srcdoc 确保内容正确加载
    iframe.srcdoc = htmlContent;

    // iframe 尺寸设置为缩放后的完整尺寸，让预览区域通过滚动条查看
    const scaledWidth = Math.ceil(totalW * scale);
    const scaledHeight = Math.ceil(totalH * scale);
    iframe.style.width = scaledWidth + "px";
    iframe.style.height = scaledHeight + "px";

    // 绑定移除事件
    wrapper.querySelectorAll(".smartsnapshot-remove-item").forEach((btn, i) => {
      btn.addEventListener("click", () => {
        deselectElement(selectedArray[i]);
        updatePreview();
        updateButtons();
      });
    });

    state.previewContainer.innerHTML = "";
    state.previewContainer.appendChild(wrapper);
  }

  function updateButtons() {
    const has = state.selectedElements.size > 0;
    const saveBtn = document.getElementById("smartsnapshot-save");
    const forgetBtn = document.getElementById("smartsnapshot-forget");
    const screenshotBtn = document.getElementById("smartsnapshot-screenshot");
    const markdownBtn = document.getElementById("smartsnapshot-markdown");
    if (saveBtn) saveBtn.disabled = !has;
    if (forgetBtn) forgetBtn.disabled = !has;
    if (screenshotBtn) screenshotBtn.disabled = !has;
    if (markdownBtn) markdownBtn.disabled = !has;
  }

  /**
   * 将 HTML 元素转换为 Markdown 文本
   */
  function elementToMarkdown(element, baseUrl) {
    const tagName = element.tagName.toLowerCase();
    let result = '';

    // 处理文本节点
    if (element.nodeType === Node.TEXT_NODE) {
      return element.textContent.trim();
    }

    // 跳过脚本和样式
    if (tagName === 'script' || tagName === 'style' || tagName === 'noscript') {
      return '';
    }

    // 处理特定标签
    switch (tagName) {
      case 'h1':
        return `# ${getElementText(element)}\n\n`;
      case 'h2':
        return `## ${getElementText(element)}\n\n`;
      case 'h3':
        return `### ${getElementText(element)}\n\n`;
      case 'h4':
        return `#### ${getElementText(element)}\n\n`;
      case 'h5':
        return `##### ${getElementText(element)}\n\n`;
      case 'h6':
        return `###### ${getElementText(element)}\n\n`;
      case 'p':
        const text = processInlineElements(element, baseUrl).trim();
        return text ? `${text}\n\n` : '';
      case 'br':
        return '\n';
      case 'hr':
        return '---\n\n';
      case 'a':
        const href = element.getAttribute('href');
        const linkText = getElementText(element);
        if (href) {
          const absoluteUrl = resolveUrl(href, baseUrl);
          // 如果是图片链接
          const img = element.querySelector('img');
          if (img) {
            return `[![${img.alt || ''}](${resolveUrl(img.src, baseUrl)})](${absoluteUrl})`;
          }
          return `[${linkText}](${absoluteUrl})`;
        }
        return linkText;
      case 'img':
        const src = element.getAttribute('src');
        const alt = element.getAttribute('alt') || '';
        if (src) {
          return `![${alt}](${resolveUrl(src, baseUrl)})`;
        }
        return '';
      case 'ul':
        return processList(element, baseUrl, '-') + '\n';
      case 'ol':
        return processList(element, baseUrl, '1.') + '\n';
      case 'li':
        // li 会在 processList 中处理
        return '';
      case 'blockquote':
        const quoteText = getElementText(element).trim();
        return quoteText ? `> ${quoteText.replace(/\n/g, '\n> ')}\n\n` : '';
      case 'pre':
        const codeBlock = element.querySelector('code');
        if (codeBlock) {
          const lang = codeBlock.className.match(/language-(\w+)/)?.[1] || '';
          const code = codeBlock.textContent.trim();
          return `\`\`\`${lang}\n${code}\n\`\`\`\n\n`;
        }
        return `\`\`\`\n${getElementText(element).trim()}\n\`\`\`\n\n`;
      case 'code':
        // 行内代码
        if (element.parentElement?.tagName.toLowerCase() !== 'pre') {
          return `\`${element.textContent}\``;
        }
        return element.textContent;
      case 'table':
        return processTable(element, baseUrl);
      case 'strong':
      case 'b':
        return `**${processInlineElements(element, baseUrl)}**`;
      case 'em':
      case 'i':
        return `*${processInlineElements(element, baseUrl)}*`;
      case 'del':
      case 's':
        return `~~${processInlineElements(element, baseUrl)}~~`;
      default:
        // 递归处理子元素
        return processChildren(element, baseUrl);
    }
  }

  /**
   * 获取元素的纯文本内容
   */
  function getElementText(element) {
    return element.textContent.trim();
  }

  /**
   * 处理行内元素
   */
  function processInlineElements(element, baseUrl) {
    let result = '';
    for (const child of element.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        result += child.textContent;
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        result += elementToMarkdown(child, baseUrl);
      }
    }
    return result;
  }

  /**
   * 处理子元素
   */
  function processChildren(element, baseUrl) {
    let result = '';
    for (const child of element.childNodes) {
      if (child.nodeType === Node.TEXT_NODE) {
        result += child.textContent;
      } else if (child.nodeType === Node.ELEMENT_NODE) {
        result += elementToMarkdown(child, baseUrl);
      }
    }
    return result;
  }

  /**
   * 处理列表
   */
  function processList(list, baseUrl, marker) {
    let result = '';
    let index = 1;
    for (const child of list.children) {
      if (child.tagName.toLowerCase() === 'li') {
        const prefix = marker === '1.' ? `${index}. ` : '- ';
        const text = processInlineElements(child, baseUrl).trim();
        // 处理嵌套列表
        const nestedList = child.querySelector('ul, ol');
        if (nestedList) {
          const nestedContent = elementToMarkdown(nestedList, baseUrl);
          result += prefix + text.replace(nestedContent, '').trim() + '\n';
          result += nestedContent.split('\n').map(line => '  ' + line).join('\n') + '\n';
        } else {
          result += prefix + text + '\n';
        }
        index++;
      }
    }
    return result;
  }

  /**
   * 处理表格
   */
  function processTable(table, baseUrl) {
    const rows = table.querySelectorAll('tr');
    if (rows.length === 0) return '';

    let result = '\n';
    let isFirstRow = true;

    for (const row of rows) {
      const cells = row.querySelectorAll('th, td');
      if (cells.length === 0) continue;

      const cellTexts = [];
      for (const cell of cells) {
        cellTexts.push(processInlineElements(cell, baseUrl).trim() || ' ');
      }

      result += '| ' + cellTexts.join(' | ') + ' |\n';

      if (isFirstRow) {
        result += '|' + cellTexts.map(() => ' --- |').join('') + '\n';
        isFirstRow = false;
      }
    }

    return result + '\n';
  }

  /**
   * 解析相对 URL 为绝对 URL
   */
  function resolveUrl(url, baseUrl) {
    if (!url) return '';
    if (url.startsWith('data:') || url.startsWith('http://') || url.startsWith('https://')) {
      return url;
    }
    try {
      return new URL(url, baseUrl).href;
    } catch (e) {
      return url;
    }
  }

  /**
   * 生成选中元素的 Markdown 内容
   */
  function generateMarkdown() {
    const baseUrl = window.location.href;
    let markdown = '';

    // 添加来源信息
    markdown += `# ${document.title}\n\n`;
    markdown += `> 来源: [${window.location.hostname}](${baseUrl})\n\n`;
    markdown += `---\n\n`;

    state.selectedElements.forEach((element, index) => {
      const clone = element.cloneNode(true);
      markdown += elementToMarkdown(clone, baseUrl);
      markdown += '\n---\n\n';
    });

    return markdown.trim();
  }

  /**
   * 显示 Markdown 导出页面
   */
  async function showMarkdown() {
    if (state.selectedElements.size === 0) return;

    try {
      const markdownContent = generateMarkdown();
      
      // 收集原始 HTML 内容（用于 debug）
      const rawHtmlContent = [];
      state.selectedElements.forEach((element) => {
        const clone = cloneForExport(element);
        rawHtmlContent.push(clone.outerHTML);
      });
      
      const timestamp = new Date().toISOString().replace(/[:.]/g, '-').slice(0, 19);
      const filename = `smartsnapshot-${state.currentDomain}-${timestamp}.md`;

      // 发送给 background 打开 markdown 页面
      chrome.runtime.sendMessage(
        {
          action: 'showMarkdown',
          markdownContent: markdownContent,
          rawHtmlContent: rawHtmlContent,
          filename: filename,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error('SmartSnapshot: Runtime error', chrome.runtime.lastError);
            showNotification(getMessage('notificationPreviewFailed'), 'error');
          } else if (!response?.success) {
            showNotification(getMessage('notificationPreviewFailed'), 'error');
          } else {
            showNotification(getMessage('notificationPreviewOpened'));
          }
        },
      );
    } catch (error) {
      console.error('Markdown export failed:', error);
      showNotification(getMessage('notificationScreenshotFailed') + ': ' + error.message, 'error');
    }
  }

  /**
   * 打开预览页面展示 HTML 内容
   */
  async function takeScreenshot() {
    if (state.selectedElements.size === 0 || state.isProcessing) return;

    state.isProcessing = true;
    const screenshotBtn = document.getElementById("smartsnapshot-screenshot");
    if (screenshotBtn) {
      screenshotBtn.textContent = "处理中...";
      screenshotBtn.disabled = true;
    }

    const selectedArray = Array.from(state.selectedElements);

    try {
      // 计算边界
      let minX = Infinity,
        minY = Infinity,
        maxX = 0,
        maxY = 0;
      selectedArray.forEach((el) => {
        const rect = el.getBoundingClientRect();
        const sx = window.scrollX,
          sy = window.scrollY;
        minX = Math.min(minX, rect.left + sx);
        minY = Math.min(minY, rect.top + sy);
        maxX = Math.max(maxX, rect.right + sx);
        maxY = Math.max(maxY, rect.bottom + sy);
      });

      const padding = 20;
      minX = Math.max(0, minX - padding);
      minY = Math.max(0, minY - padding);
      maxX += padding;
      maxY += padding;

      const totalW = maxX - minX;
      const totalH = maxY - minY;

      const css = extractStyles();

      // 获取页面根元素的计算样式用于字体继承
      const rootStyle = window.getComputedStyle(document.body);
      const baseFontFamily =
        rootStyle.fontFamily || "-apple-system, BlinkMacSystemFont, sans-serif";
      const baseFontSize = rootStyle.fontSize || "16px";
      const baseLineHeight = rootStyle.lineHeight || "normal";

      // 构建 HTML 内容
      const htmlContent = `
        <!DOCTYPE html>
        <html>
        <head>
          <meta charset="UTF-8">
          <style>
            * { margin: 0; padding: 0; box-sizing: border-box; }
            html {
              font-family: ${escapeHtml(baseFontFamily)};
              font-size: ${escapeHtml(baseFontSize)};
              line-height: ${escapeHtml(baseLineHeight)};
              -webkit-font-smoothing: antialiased;
              -moz-osx-font-smoothing: grayscale;
            }
            body { 
              background: white; 
              width: ${totalW}px;
              height: ${totalH}px;
              overflow: hidden;
              font-family: inherit;
              font-size: inherit;
              line-height: inherit;
            }
            .smartsnapshot-container {
              position: relative;
              width: ${totalW}px;
              height: ${totalH}px;
            }
            .smartsnapshot-element-wrapper {
              position: absolute;
              overflow: visible;
            }
            ${css}
          </style>
        </head>
        <body>
          <div class="smartsnapshot-container">
            ${selectedArray
              .map((el) => {
                const rect = el.getBoundingClientRect();
                const sx = window.scrollX,
                  sy = window.scrollY;
                const left = rect.left + sx - minX;
                const top = rect.top + sy - minY;
                const clone = cloneForExport(el);
                return `<div class="smartsnapshot-element-wrapper" style="left:${left}px;top:${top}px;width:${rect.width}px;height:${rect.height}px;overflow:visible;">${clone.outerHTML}</div>`;
              })
              .join("")}
          </div>
        </body>
        </html>
      `;

      const timestamp = new Date()
        .toISOString()
        .replace(/[:.]/g, "-")
        .slice(0, 19);
      const filename = `smartsnapshot-${state.currentDomain}-${timestamp}.png`;

      // 发送给 background 打开预览页面
      chrome.runtime.sendMessage(
        {
          action: "showPreview",
          htmlContent: htmlContent,
          filename: filename,
          width: totalW,
          height: totalH,
        },
        (response) => {
          if (chrome.runtime.lastError) {
            console.error(
              "SmartSnapshot: Runtime error",
              chrome.runtime.lastError,
            );
            showNotification(getMessage("notificationPreviewFailed"), "error");
          } else if (!response?.success) {
            showNotification(getMessage("notificationPreviewFailed"), "error");
          } else {
            showNotification(getMessage("notificationPreviewOpened"));
          }

          state.isProcessing = false;
          if (screenshotBtn) {
            screenshotBtn.textContent = "📷 截图";
            screenshotBtn.disabled = false;
          }
        },
      );
    } catch (error) {
      console.error("Screenshot failed:", error);
      showNotification(
        getMessage("notificationScreenshotFailed") + ": " + error.message,
        "error",
      );

      state.isProcessing = false;
      if (screenshotBtn) {
        screenshotBtn.textContent = getMessage("btnScreenshot");
        screenshotBtn.disabled = false;
      }
    }
  }

  function showNotification(message, type = "success") {
    const notification = document.createElement("div");
    notification.className = `smartsnapshot-notification smartsnapshot-notification-${type}`;
    notification.textContent = message;
    state.sidebar?.appendChild(notification);
    setTimeout(() => notification.classList.add("show"), 10);
    setTimeout(() => {
      notification.classList.remove("show");
      setTimeout(() => notification.remove(), 300);
    }, 2000);
  }

  init();
})();
