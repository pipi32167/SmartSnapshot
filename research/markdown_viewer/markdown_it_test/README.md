# markdown-it 测试

## 安装

```bash
npm install markdown-it markdown-it-emoji markdown-it-highlightjs
```

## 快速开始

### Node.js
```javascript
const MarkdownIt = require('markdown-it');
const md = new MarkdownIt();

const result = md.render('# Hello World\n\nThis is **bold** text.');
console.log(result);
```

### 安全模式
```javascript
const md = new MarkdownIt({
  html: false,        // 禁用 HTML 标签（防 XSS）
  linkify: true,      // 自动转换 URL 为链接
  typographer: true   // 启用排版优化
});
```

## 插件系统

```javascript
const md = require('markdown-it')()
  .use(require('markdown-it-emoji'))
  .use(require('markdown-it-task-lists'))
  .use(require('markdown-it-footnote'));
```

## 运行测试

打开 `test.html` 在浏览器中查看渲染效果。

## 特性测试

- [x] 100% CommonMark 兼容
- [x] GFM 扩展
- [x] 插件系统
- [x] 安全模式（XSS 防护）
- [x] 源码映射

## 参考

- 文档: https://markdown-it.github.io/
- GitHub: https://github.com/markdown-it/markdown-it
- 在线演示: https://markdown-it.github.io/
