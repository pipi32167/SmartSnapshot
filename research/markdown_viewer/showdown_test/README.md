# showdown.js 测试

## 安装

```bash
npm install showdown
```

## 快速开始

```javascript
const showdown = require('showdown');
const converter = new showdown.Converter();

const html = converter.makeHtml('# Hello World\n\nThis is **bold** text.');
console.log(html);
```

## 配置选项

```javascript
const converter = new showdown.Converter({
  tables: true,           // 启用表格
  simplifiedAutoLink: true, // 自动链接
  strikethrough: true,    // 删除线
  tasklists: true,        // 任务列表
  smoothLivePreview: true // 平滑预览
});
```

## 扩展

```javascript
// 自定义扩展
showdown.extension('myExt', () => {
  return [{
    type: 'lang',
    regex: /\(c\)/g,
    replace: '©'
  }];
});

converter.useExtension('myExt');
```

## 运行测试

打开 `test.html` 查看浏览器效果。

## 历史背景

showdown 是最早的 JavaScript Markdown 解析器之一（2012年发布），最初是 Markdown.js 的分支。

## 特点

- 历史悠久，兼容性好
- 支持多种 Markdown 方言
- 配置丰富
- **注意**：维护不如从前活跃

## 参考

- GitHub: https://github.com/showdownjs/showdown
- 文档: https://showdownjs.com/
