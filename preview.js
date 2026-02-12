let previewData = null;

// 加载预览数据
async function loadPreviewData() {
  try {
    const result = await chrome.storage.local.get('previewData');
    previewData = result.previewData;
    
    if (!previewData) {
      document.getElementById('previewContainer').innerHTML = '<div class="empty">未找到预览数据，请重新生成截图</div>';
      document.getElementById('saveBtn').disabled = true;
      return;
    }
    
    // 更新信息
    document.getElementById('infoText').textContent = 
      `尺寸: ${previewData.width}px × ${previewData.height}px | 文件名: ${previewData.filename}`;
    
    // 创建预览
    const container = document.getElementById('previewContainer');
    container.innerHTML = `
      <div class="preview-wrapper">
        <iframe id="previewFrame" width="${previewData.width}" height="${previewData.height}"></iframe>
      </div>
    `;
    
    // 写入 HTML 内容
    const iframe = document.getElementById('previewFrame');
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    doc.open();
    doc.write(previewData.htmlContent);
    doc.close();
    
  } catch (error) {
    console.error('加载预览数据失败:', error);
    document.getElementById('previewContainer').innerHTML = 
      '<div class="empty">加载失败: ' + error.message + '</div>';
  }
}

// 显示状态消息
function showStatus(message, type = 'success') {
  const status = document.getElementById('status');
  status.textContent = message;
  status.className = 'status show ' + type;
  setTimeout(() => {
    status.classList.remove('show');
  }, 3000);
}

// 保存截图
async function saveScreenshot() {
  if (!previewData) {
    showStatus('没有可保存的内容', 'error');
    return;
  }
  
  const btn = document.getElementById('saveBtn');
  btn.textContent = '生成中...';
  btn.disabled = true;
  
  try {
    const iframe = document.getElementById('previewFrame');
    const doc = iframe.contentDocument || iframe.contentWindow.document;
    
    // 等待图片加载 - 更精确的检测
    const images = Array.from(doc.querySelectorAll('img'));
    await Promise.all(images.map(img => {
      return new Promise((resolve) => {
        // 如果图片已经加载完成
        if (img.complete && img.naturalWidth > 0) {
          resolve();
          return;
        }
        // 监听加载事件
        const onLoad = () => {
          cleanup();
          resolve();
        };
        const onError = () => {
          cleanup();
          resolve(); // 即使加载失败也继续
        };
        const cleanup = () => {
          img.removeEventListener('load', onLoad);
          img.removeEventListener('error', onError);
        };
        img.addEventListener('load', onLoad);
        img.addEventListener('error', onError);
        // 超时处理
        setTimeout(() => {
          cleanup();
          resolve();
        }, 3000);
      });
    }));
    
    // 等待渲染完成
    await new Promise(r => setTimeout(r, 500));
    
    // 使用 html2canvas 截图 - 启用 CORS
    const container = doc.querySelector('.smartsnapshot-container');
    if (!container) {
      throw new Error('未找到内容容器');
    }
    
    const canvas = await html2canvas(container, {
      scale: 2,
      useCORS: true,
      allowTaint: true,
      backgroundColor: '#ffffff',
      logging: false,
      foreignObjectRendering: false,
      width: previewData.width,
      height: previewData.height,
      windowWidth: previewData.width,
      windowHeight: previewData.height
    });
    
    // 转换为 blob 并下载
    const blob = await new Promise(resolve => canvas.toBlob(resolve, 'image/png'));
    const url = URL.createObjectURL(blob);
    
    const a = document.createElement('a');
    a.href = url;
    a.download = previewData.filename;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    
    URL.revokeObjectURL(url);
    showStatus('截图已保存');
    
  } catch (error) {
    console.error('保存失败:', error);
    showStatus('保存失败: ' + error.message, 'error');
  } finally {
    btn.textContent = '💾 保存截图';
    btn.disabled = false;
  }
}

// 绑定事件
document.getElementById('saveBtn').addEventListener('click', saveScreenshot);

// 页面加载完成后加载数据
document.addEventListener('DOMContentLoaded', loadPreviewData);
