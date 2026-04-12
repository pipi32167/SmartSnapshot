import { marked } from 'marked';

const markdown = `
# marked.js Demo

## 特性

- ⚡ **极速**：基于正则表达式的高效解析
- 📦 **零依赖**：单文件，无外部依赖
- 🔧 **可扩展**：支持自定义渲染器

## 代码示例

\`\`\`javascript
const html = marked.parse('# Hello World');
console.log(html);
\`\`\`

## 表格

| 库 | 体积 | 速度 |
|----|------|------|
| marked | 25KB | 快 |
| markdown-it | 45KB | 中等 |

> 更多详情：[marked.js.org](https://marked.js.org/)
`;

console.log('=== marked.js 渲染结果 ===\n');
console.log(marked.parse(markdown));
