# SmartSnapshot - AI Agent 开发指南

## 项目概述

SmartSnapshot 是一个基于 Chrome Extension Manifest V3 的智能网页元素选择器扩展。用户可以通过点击扩展图标进入选择模式，在网页上选择多个元素，并在侧边栏中实时预览，最终可以将选中的内容合并保存为 PNG 图片。

### 核心功能

- 🔍 **元素选择**：模仿 Chrome DevTools 的鼠标悬停高亮和点击选择功能
- ✨ **多选支持**：点击选中，再次点击取消选择
- 👁️ **实时预览**：右侧 sidebar 显示选中元素的合并预览
- 📸 **一键截图**：使用 Chrome Debugger API 和 Canvas API 将选中的元素合并保存为 PNG 图片
- 💾 **智能记忆**：按域名自动保存和恢复选择（使用 Chrome Storage API）
- ⌨️ **快捷键支持**：ESC 键退出选择模式
- 🌍 **国际化支持**：支持简体中文（默认）和英文

## 技术栈

| 技术 | 版本/说明 |
|------|----------|
| Manifest Version | Chrome Extension Manifest V3 |
| 前端 | 原生 JavaScript (ES6+)、CSS3 |
| 截图引擎 | Chrome Debugger API + Canvas API（html2canvas v1.4.1 备用）|
| 存储 | Chrome Storage API (local) |
| 国际化 | Chrome i18n API |
| 权限 | storage, activeTab, scripting, downloads, debugger |

## 项目结构

```
SmartSnapshot/
├── manifest.json          # 扩展配置文件 (Manifest V3)
├── background.js          # Service Worker - 后台脚本
├── content-script.js      # 内容脚本 - 页面交互核心逻辑
├── styles.css             # 样式文件 - 侧边栏和元素高亮样式
├── html2canvas.min.js     # 第三方截图库（v1.4.1，压缩版）
├── preview.html           # 预览页面 HTML
├── preview.js             # 预览页面脚本
├── README.md              # 用户说明文档（英文）
├── README.zh-CN.md        # 用户说明文档（中文）
├── AGENTS.md              # 本文件 - AI Agent 开发指南
├── _locales/              # 国际化资源文件
│   ├── en/messages.json   # 英文翻译
│   └── zh_CN/messages.json # 简体中文翻译（默认语言）
├── icons/                 # 扩展图标
│   ├── icon16.png         # 工具栏图标 (16x16)
│   ├── icon48.png         # 扩展管理页图标 (48x48)
│   └── icon128.png        # Chrome Web Store 图标 (128x128)
└── snapshots/             # 截图示例
    ├── effect.png
    └── usage.png
```

## 架构说明

### 1. Background Service Worker (`background.js`)

后台脚本负责：
- 监听扩展图标点击事件，切换选择模式开关状态
- 维护每个标签页的选择状态（`activeTabs` Set）
- 向内容脚本发送开始/停止选择的消息
- 处理截图请求（`captureTab`、`captureTabCropped`）
- 处理预览页面打开请求（`showPreview`）
- 处理下载请求（`downloadScreenshot`）
- 更新扩展图标徽章（Badge）显示当前状态

**关键状态管理**:
```javascript
const activeTabs = new Set();  // 记录处于选择模式的标签页 ID
```

**核心截图方法**:
- `captureVisibleTabDataUrl()`: 使用 `chrome.tabs.captureVisibleTab` 捕获可见区域
- `captureTabCroppedWithDebugger()`: 使用 Chrome Debugger API 进行精确裁剪截图

### 2. Content Script (`content-script.js`)

内容脚本是核心逻辑所在，在网页上下文中运行：

**状态对象** (`state`):
- `isActive`: 是否处于选择模式
- `hoveredElement`: 当前悬停的元素
- `selectedElements`: 已选中的元素集合 (Set)
- `highlightedElements`: 已高亮的元素集合 (Set)
- `currentDomain`: 当前域名
- `sidebar`: 侧边栏 DOM 元素引用
- `previewContainer`: 预览容器引用
- `isProcessing`: 截图处理中标志

**主要模块**:
1. **选择模式管理**: `startSelection()` / `stopSelection()`
2. **元素选择逻辑**: `handleMouseMove()` / `handleClick()` / `selectElement()` / `deselectElement()`
3. **侧边栏 UI**: `createSidebar()` / `removeSidebar()` / `updatePreview()`
4. **选择器生成**: `getUniqueSelector()` - 生成可用于恢复选择的 CSS 选择器
5. **截图功能**: `takeScreenshot()` - 构建 HTML 内容并发送到预览页面
6. **存储管理**: `saveSelections()` / `loadSavedSelections()` / `forgetSelections()`

**重要约束**:
- 选择父元素后，其子孙元素无法再被选择 (`isDescendantOfSelected`)
- 选择子元素时，会自动替换其父元素

### 3. 预览页面 (`preview.html` + `preview.js`)

独立的预览页面用于：
- 渲染选中的元素内容（通过 iframe）
- 使用 Chrome Debugger API 进行高质量截图
- 显示截图结果模态框
- 支持重新生成和保存截图

**截图流程**:
1. 从 Storage 读取 `previewData`
2. 在 iframe 中渲染 HTML 内容
3. 进入 capture-only 布局（隐藏 UI 元素）
4. 使用 `chrome.debugger` 发送 `Page.captureScreenshot` 命令
5. 显示结果模态框
6. 退出 capture-only 布局

### 4. 样式文件 (`styles.css`)

CSS 命名规范: 所有类名使用 `smartsnapshot-` 前缀避免与页面样式冲突

**主要样式模块**:
- 元素高亮: `.smartsnapshot-hover` (蓝色) / `.smartsnapshot-selected` (绿色)
- 侧边栏: `#smartsnapshot-sidebar` (固定右侧，z-index: 2147483647)
- 预览区域: `.smartsnapshot-preview-content` 使用 iframe 沙盒渲染
- 按钮组件: `.smartsnapshot-btn-*` 系列

## 数据流

### 选择模式切换
```
用户点击图标 → background.js 发送消息 → content-script.js 启动/停止选择模式
```

### 元素选择保存
```
用户点击"保存选择" → getUniqueSelector() 生成 CSS 选择器 → Chrome Storage API 按域名存储
```

### 截图流程
```
1. 隐藏侧边栏 → 移除选中元素高亮样式
2. 计算选中元素边界框 → 创建 HTML 内容
3. cloneForExport() 克隆元素并修复资源路径
4. extractStyles() 提取页面样式
5. 发送到预览页面 → iframe 渲染内容
6. 使用 Chrome Debugger API 截图
7. 显示结果模态框 → 用户点击保存下载
```

## 开发规范

### 代码风格

- **缩进**: 2 个空格
- **引号**: 单引号优先
- **注释**: 使用 JSDoc 格式描述函数功能
- **命名**: 
  - 常量: 大写 + 下划线 (`SELECTED_CLASS`)
  - 函数: 驼峰命名 (`handleMouseMove`)
  - 类名: 小写 + 连字符 (CSS: `smartsnapshot-selected`)

### CSS 隔离原则

所有扩展相关的 CSS 类必须以 `smartsnapshot-` 开头，确保不会与宿主页面样式冲突。

### 错误处理

- 使用 `try-catch` 包裹所有 Chrome API 调用
- 异步操作失败时静默处理（使用空 catch）或使用 `showNotification()` 提示用户

### 消息通信

Background 与 Content Script 间的消息格式:
```javascript
// Background → Content Script
{ action: 'startSelection', domain: 'example.com' }
{ action: 'stopSelection' }

// Content Script → Background
{ action: 'selectionStopped' }
{ action: 'showPreview', htmlContent: '...', filename: '...', width: 100, height: 100 }
{ action: 'captureTab' }
{ action: 'captureTabCropped', width: 100, height: 100 }
```

## 国际化 (i18n)

### 架构

扩展使用 Chrome Extension i18n API 实现多语言支持：

- **默认语言**: 简体中文 (zh_CN)
- **支持语言**: 英文 (en)、简体中文 (zh_CN)
- **资源位置**: `_locales/<lang>/messages.json`

### 添加新文本的步骤

1. **在 `manifest.json` 中使用**:
   ```json
   "name": "__MSG_extensionName__",
   "description": "__MSG_extensionDescription__",
   "default_title": "__MSG_actionTitle__"
   ```

2. **在 JavaScript 中使用**:
   ```javascript
   // 使用辅助函数（推荐）
   function getMessage(key, args) {
     if (typeof chrome !== 'undefined' && chrome.i18n) {
       return chrome.i18n.getMessage(key, args);
     }
     // Fallback...
   }
   
   showNotification(getMessage('notificationSaved'));
   ```

3. **在 HTML 中使用**:
   ```html
   <span data-i18n="emptyHint">点击页面元素开始选择</span>
   ```
   然后在 JavaScript 中调用 `applyI18n()` 应用翻译。

4. **更新所有 `messages.json` 文件**:
   - `_locales/en/messages.json`
   - `_locales/zh_CN/messages.json`

### 占位符使用

```json
{
  "elementCount": {
    "message": "$COUNT$ elements",
    "placeholders": {
      "count": {
        "content": "$1",
        "example": "3"
      }
    }
  }
}
```

调用方式:
```javascript
getMessage('elementCount', [3])  // "3 elements"
```

## 安装和调试

### 开发加载方式

1. 打开 Chrome 浏览器，进入 `chrome://extensions/`
2. 开启右上角的「开发者模式」
3. 点击「加载已解压的扩展程序」
4. 选择本项目文件夹

### 调试指南

#### 查看日志

1. **Background 脚本日志**: 
   - 打开 `chrome://extensions/`
   - 找到 SmartSnapshot，点击"Service Worker"查看背景页 DevTools

2. **Content Script 日志**:
   - 在任意网页打开 DevTools (F12)
   - 查看 Console 面板，过滤包含 "SmartSnapshot" 的日志

3. **预览页面日志**:
   - 在预览页面打开 DevTools (F12)
   - 查看 Console 面板

#### 测试流程

1. 修改代码后，在 `chrome://extensions/` 页面点击刷新按钮重新加载扩展
2. 测试不同网站（考虑 CSP 限制的网站如 GitHub）
3. 测试选择嵌套元素（父子关系）的行为
4. 测试截图后的文件下载

#### 常见问题

- **选择器失效**: 页面 DOM 结构变化后，保存的 CSS 选择器可能无法定位元素
- **样式丢失**: 跨域引用的 CSS 文件无法通过 `document.styleSheets` 访问
- **截图空白**: 某些使用 Shadow DOM 或 Canvas 渲染的内容可能无法被捕获
- **Debugger 权限**: 使用 `chrome.debugger` 需要 `debugger` 权限，且会显示"Chrome 正受到自动测试软件控制"的提示

## 安全注意事项

1. **CSP 限制**: Manifest V3 的 CSP 较严格，内联脚本会被阻止。所有 JavaScript 必须放在外部文件中。

2. **跨域资源**: 截图时可能遇到跨域图片问题。当前策略是优先使用 Chrome Debugger API，回退到 `captureVisibleTab`。

3. **XSS 防护**:
   - 预览 iframe 使用 `sandbox="allow-same-origin"` 属性
   - `cloneForExport()` 函数会移除所有 `<script>` 标签和事件处理器 (`on*` 属性)
   - 使用 `escapeHtml()` 函数转义动态内容

4. **样式隔离**: 侧边栏使用极高的 `z-index: 2147483647` 确保不被页面覆盖

5. **权限最小化**: 仅请求必要的权限（storage, activeTab, scripting, downloads, debugger）

6. **国际化安全**:
   - 所有翻译文本必须通过 `chrome.i18n.getMessage()` 获取，避免硬编码
   - Fallback 文本必须与默认语言（zh_CN）保持一致
   - 占位符参数在使用前必须验证类型

## 扩展开发参考

- [Chrome Extension 官方文档](https://developer.chrome.com/docs/extensions/mv3/)
- [Manifest V3 迁移指南](https://developer.chrome.com/docs/extensions/mv3/mv3-migration/)
- [Chrome Debugger API](https://developer.chrome.com/docs/extensions/reference/debugger/)
- [Chrome Storage API](https://developer.chrome.com/docs/extensions/reference/storage/)
- [Chrome i18n API](https://developer.chrome.com/docs/extensions/reference/i18n/)
