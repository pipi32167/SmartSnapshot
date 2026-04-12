const showdown = require('showdown');

// 创建转换器
const converter = new showdown.Converter({
  tables: true,
  simplifiedAutoLink: true,
  strikethrough: true,
  tasklists: true,
  smoothLivePreview: true
});

const markdown = `
# showdown.js Demo

## 历史

showdown 是最早的 JavaScript Markdown 解析器之一，2012 年发布。

## 特性

- **兼容性好**：支持多种 Markdown 方言
- **配置丰富**：大量可选项
- **扩展系统**：支持自定义扩展

## 自动链接

访问 https://github.com/showdownjs/showdown 了解更多。

## 表格

| 库 | 年份 | 状态 |
|----|------|------|
| showdown | 2012 | 维护放缓 |
| marked | 2011 | 活跃 |
| markdown-it | 2014 | 活跃 |

## 任务列表

- [x] 学习 showdown
- [ ] 对比其他库
- [ ] 做出选择

## 删除线

~~这是被删除的文本~~

## 自定义扩展

(c) -> ©
(r) -> ®
(tm) -> ™
`;

console.log('=== showdown.js 渲染结果 ===\n');
console.log(converter.makeHtml(markdown));

// 自定义扩展示例
showdown.extension('symbols', () => [
  { type: 'lang', regex: /\(c\)/gi, replace: '©' },
  { type: 'lang', regex: /\(r\)/gi, replace: '®' },
  { type: 'lang', regex: /\(tm\)/gi, replace: '™' }
]);

const converter2 = new showdown.Converter({ extensions: ['symbols'] });
console.log('\n=== 自定义扩展效果 ===\n');
console.log(converter2.makeHtml('Copyright (c) 2024 (r) Company (tm)'));
