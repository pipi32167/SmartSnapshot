/**
 * SmartSnapshot Markdown Export Page
 * Handles markdown display, copy, and download functionality
 */

(function () {
  'use strict';

  let markdownData = null;

  /**
   * Get localized message
   */
  function getMessage(key) {
    if (typeof chrome !== 'undefined' && chrome.i18n && chrome.i18n.getMessage) {
      return chrome.i18n.getMessage(key);
    }
    // Fallback messages
    const fallbacks = {
      notificationCopied: 'Copied to clipboard',
      notificationCopyFailed: 'Copy failed',
      notificationHtmlCopied: 'HTML copied to clipboard',
      markdownEmpty: 'No content to export',
      btnCopy: 'Copy Markdown',
      btnCopyHtml: 'Copy HTML',
      btnDownload: 'Download',
      btnClose: 'Close',
    };
    return fallbacks[key] || key;
  }

  /**
   * Initialize the page
   */
  async function init() {
    // Load markdown data from storage
    try {
      const result = await chrome.storage.local.get('markdownData');
      markdownData = result.markdownData;

      if (markdownData && markdownData.markdownContent) {
        displayContent();
      } else {
        showEmptyState();
      }
    } catch (error) {
      console.error('Failed to load markdown data:', error);
      showError('Failed to load markdown data');
    }

    // Bind events
    bindEvents();
  }

  /**
   * Display the markdown content
   */
  function displayContent() {
    const textarea = document.getElementById('markdown-content');
    const fileInfo = document.getElementById('file-info');
    const charCount = document.getElementById('char-count');
    const lineCount = document.getElementById('line-count');
    const btnCopy = document.getElementById('btn-copy');
    const btnCopyHtml = document.getElementById('btn-copy-html');
    const btnDownload = document.getElementById('btn-download');

    const content = markdownData.markdownContent;
    const filename = markdownData.filename || 'export.md';

    // Set content
    textarea.value = content;
    textarea.readOnly = false;

    // Update info
    fileInfo.textContent = filename;
    fileInfo.className = 'filename';
    charCount.textContent = `${content.length.toLocaleString()} characters`;

    const lines = content.split('\n').length;
    lineCount.textContent = `${lines} line${lines !== 1 ? 's' : ''}`;

    // Enable buttons
    btnCopy.disabled = false;
    btnCopyHtml.disabled = !(markdownData.rawHtmlContent && markdownData.rawHtmlContent.length > 0);
    btnDownload.disabled = false;
  }

  /**
   * Show empty state
   */
  function showEmptyState() {
    const container = document.querySelector('.container');
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">📝</div>
        <p>${getMessage('markdownEmpty')}</p>
      </div>
    `;
  }

  /**
   * Show error message
   */
  function showError(message) {
    const container = document.querySelector('.container');
    container.innerHTML = `
      <div class="empty-state">
        <div class="empty-state-icon">⚠️</div>
        <p>${message}</p>
      </div>
    `;
  }

  /**
   * Bind event listeners
   */
  function bindEvents() {
    document.getElementById('btn-copy')?.addEventListener('click', copyToClipboard);
    document.getElementById('btn-copy-html')?.addEventListener('click', copyRawHtml);
    document.getElementById('btn-download')?.addEventListener('click', downloadMarkdown);
    document.getElementById('btn-close')?.addEventListener('click', () => window.close());

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
      // Ctrl/Cmd + C is handled by the textarea
      // Esc to close
      if (e.key === 'Escape') {
        window.close();
      }
      // Ctrl/Cmd + S to download
      if ((e.ctrlKey || e.metaKey) && e.key === 's') {
        e.preventDefault();
        downloadMarkdown();
      }
    });
  }

  /**
   * Copy markdown content to clipboard
   */
  async function copyToClipboard() {
    const textarea = document.getElementById('markdown-content');
    const content = textarea.value;

    if (!content) {
      showNotification(getMessage('markdownEmpty'), 'error');
      return;
    }

    try {
      await navigator.clipboard.writeText(content);
      showNotification(getMessage('notificationCopied'), 'success');
    } catch (error) {
      console.error('Copy failed:', error);
      // Fallback: select and copy
      try {
        textarea.select();
        document.execCommand('copy');
        showNotification(getMessage('notificationCopied'), 'success');
      } catch (fallbackError) {
        showNotification(getMessage('notificationCopyFailed'), 'error');
      }
    }
  }

  /**
   * Copy raw HTML content to clipboard
   */
  async function copyRawHtml() {
    if (!markdownData || !markdownData.rawHtmlContent || markdownData.rawHtmlContent.length === 0) {
      showNotification('No HTML content available', 'error');
      return;
    }

    // Join all HTML elements with a separator
    const htmlContent = markdownData.rawHtmlContent.join('\n\n<!-- Element Separator -->\n\n');

    try {
      await navigator.clipboard.writeText(htmlContent);
      showNotification(getMessage('notificationHtmlCopied'), 'success');
    } catch (error) {
      console.error('Copy HTML failed:', error);
      // Fallback
      try {
        const textarea = document.createElement('textarea');
        textarea.value = htmlContent;
        textarea.style.position = 'fixed';
        textarea.style.opacity = '0';
        document.body.appendChild(textarea);
        textarea.select();
        document.execCommand('copy');
        document.body.removeChild(textarea);
        showNotification(getMessage('notificationHtmlCopied'), 'success');
      } catch (fallbackError) {
        showNotification(getMessage('notificationCopyFailed'), 'error');
      }
    }
  }

  /**
   * Download markdown as file
   */
  function downloadMarkdown() {
    if (!markdownData || !markdownData.markdownContent) {
      showNotification(getMessage('markdownEmpty'), 'error');
      return;
    }

    const blob = new Blob([markdownData.markdownContent], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const filename = markdownData.filename || 'export.md';

    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);

    showNotification('Download started', 'success');
  }

  /**
   * Show notification
   */
  function showNotification(message, type = 'success') {
    const notification = document.getElementById('notification');
    notification.textContent = message;
    notification.className = `notification ${type}`;

    // Show
    requestAnimationFrame(() => {
      notification.classList.add('show');
    });

    // Hide after 2 seconds
    setTimeout(() => {
      notification.classList.remove('show');
    }, 2000);
  }

  // Initialize when DOM is ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
