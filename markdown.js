/**
 * SmartSnapshot Markdown Export Page
 * Handles markdown display, copy, download, and preview functionality
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
      tabRaw: 'Raw',
      tabPreview: 'Preview',
    };
    return fallbacks[key] || key;
  }

  /**
   * Initialize the page
   */
  async function init() {
    // Apply i18n
    applyI18n();

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
   * Apply i18n to UI elements
   */
  function applyI18n() {
    document.getElementById('tab-raw-text').textContent = getMessage('tabRaw');
    document.getElementById('tab-preview-text').textContent = getMessage('tabPreview');
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

    // Render preview
    renderPreview();
  }

  /**
   * Render markdown to HTML preview
   */
  function renderPreview() {
    const previewContainer = document.getElementById('preview-container');
    const markdown = markdownData.markdownContent || '';
    const html = markdownToHtml(markdown);
    previewContainer.innerHTML = html;
  }

  /**
   * Convert markdown text to HTML
   */
  function markdownToHtml(markdown) {
    if (!markdown) return '<p style="color: #888; text-align: center; padding: 40px;">No content</p>';

    let html = markdown;

    // Escape HTML special characters (but preserve markdown syntax for processing)
    const escapeHtml = (text) => {
      return text
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;');
    };

    // Store code blocks temporarily to protect them from other transformations
    const codeBlocks = [];
    html = html.replace(/```([\w]*)([\s\S]*?)```/g, (match, lang, code) => {
      const index = codeBlocks.length;
      const escapedCode = escapeHtml(code.trim());
      const langClass = lang ? ` class="language-${lang}"` : '';
      codeBlocks.push(`<pre><code${langClass}>${escapedCode}</code></pre>`);
      return `<!--CODE_BLOCK_${index}-->`;
    });

    // Store inline code temporarily
    const inlineCodes = [];
    html = html.replace(/`([^`]+)`/g, (match, code) => {
      const index = inlineCodes.length;
      inlineCodes.push(`<code>${escapeHtml(code)}</code>`);
      return `<!--INLINE_CODE_${index}-->`;
    });

    // Headers
    html = html.replace(/^###### (.*$)/gim, '<h6>$1</h6>');
    html = html.replace(/^##### (.*$)/gim, '<h5>$1</h5>');
    html = html.replace(/^#### (.*$)/gim, '<h4>$1</h4>');
    html = html.replace(/^### (.*$)/gim, '<h3>$1</h3>');
    html = html.replace(/^## (.*$)/gim, '<h2>$1</h2>');
    html = html.replace(/^# (.*$)/gim, '<h1>$1</h1>');

    // Horizontal rule
    html = html.replace(/^---+$/gim, '<hr>');
    html = html.replace(/^\*\*\*+$/gim, '<hr>');
    html = html.replace(/^___+$/gim, '<hr>');

    // Blockquote
    html = html.replace(/^> (.*$)/gim, '<blockquote>$1</blockquote>');

    // Images
    html = html.replace(/!\[([^\]]*)\]\(([^)]+)\)/g, '<img src="$2" alt="$1">');

    // Links
    html = html.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

    // Bold and Italic (order matters)
    html = html.replace(/\*\*\*([^*]+)\*\*\*/g, '<strong><em>$1</em></strong>');
    html = html.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
    html = html.replace(/\*([^*]+)\*/g, '<em>$1</em>');
    html = html.replace(/___([^_]+)___/g, '<strong><em>$1</em></strong>');
    html = html.replace(/__([^_]+)__/g, '<strong>$1</strong>');
    html = html.replace(/_([^_]+)_/g, '<em>$1</em>');

    // Strikethrough
    html = html.replace(/~~([^~]+)~~/g, '<del>$1</del>');

    // Unordered lists
    html = html.replace(/^(\s*)[-*+] (.*$)/gim, (match, indent, content) => {
      const level = Math.floor(indent.length / 2);
      return `<ul style="margin-left: ${level * 20}px"><li>${content}</li></ul>`;
    });

    // Ordered lists
    html = html.replace(/^(\s*)(\d+)\. (.*$)/gim, (match, indent, num, content) => {
      const level = Math.floor(indent.length / 2);
      return `<ol style="margin-left: ${level * 20}px" start="${num}"><li>${content}</li></ol>`;
    });

    // Tables (simple support)
    const tableRegex = /^(\|[^\n]+\|)\n(\|[-:\|\s]+\|)\n((?:\|[^\n]+\|\n?)+)/gm;
    html = html.replace(tableRegex, (match, header, separator, rows) => {
      const headerCells = header.split('|').filter(c => c.trim()).map(c => `<th>${c.trim()}</th>`).join('');
      const rowCells = rows.trim().split('\n').map(row => {
        const cells = row.split('|').filter(c => c.trim()).map(c => `<td>${c.trim()}</td>`).join('');
        return `<tr>${cells}</tr>`;
      }).join('');
      return `<table><thead><tr>${headerCells}</tr></thead><tbody>${rowCells}</tbody></table>`;
    });

    // Line breaks and paragraphs
    // First, protect consecutive newlines for block elements
    html = html.replace(/\n\n+/g, '</p><p>');
    html = html.replace(/\n/g, '<br>');

    // Wrap in paragraph if not already wrapped in a block element
    if (!html.startsWith('<')) {
      html = '<p>' + html + '</p>';
    }

    // Clean up block elements (remove surrounding <p> tags)
    html = html.replace(/<p>(<h[1-6]>.*?<\/h[1-6]>)<\/p>/g, '$1');
    html = html.replace(/<p>(<blockquote>.*?<\/blockquote>)<\/p>/g, '$1');
    html = html.replace(/<p>(<pre>.*?<\/pre>)<\/p>/gs, '$1');
    html = html.replace(/<p>(<table>.*?<\/table>)<\/p>/gs, '$1');
    html = html.replace(/<p>(<hr>)<\/p>/g, '$1');
    html = html.replace(/<p>(<ul>.*?<\/ul>)<\/p>/gs, '$1');
    html = html.replace(/<p>(<ol>.*?<\/ol>)<\/p>/gs, '$1');

    // Restore inline code
    html = html.replace(/<!--INLINE_CODE_(\d+)-->/g, (match, index) => inlineCodes[parseInt(index)]);

    // Restore code blocks
    html = html.replace(/<!--CODE_BLOCK_(\d+)-->/g, (match, index) => codeBlocks[parseInt(index)]);

    // Clean up empty paragraphs
    html = html.replace(/<p><\/p>/g, '');

    return html;
  }

  /**
   * Switch between tabs
   */
  function switchTab(tabName) {
    // Update tab buttons
    document.querySelectorAll('.tab').forEach(tab => {
      tab.classList.toggle('active', tab.dataset.tab === tabName);
    });

    // Update tab content
    document.querySelectorAll('.tab-content').forEach(content => {
      content.classList.toggle('active', content.id === `tab-${tabName}`);
    });

    // Re-render preview when switching to it (in case content changed)
    if (tabName === 'preview') {
      renderPreview();
    }
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

    // Tab switching
    document.querySelectorAll('.tab').forEach(tab => {
      tab.addEventListener('click', () => switchTab(tab.dataset.tab));
    });

    // Keyboard shortcuts
    document.addEventListener('keydown', (e) => {
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

    // Re-render preview when textarea content changes
    const textarea = document.getElementById('markdown-content');
    if (textarea) {
      textarea.addEventListener('input', () => {
        if (markdownData) {
          markdownData.markdownContent = textarea.value;
        }
      });
    }
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
