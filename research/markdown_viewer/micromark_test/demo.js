import { micromark } from 'micromark';

const markdown = `
# micromark Demo

## 特点

- **极小**：~15KB gzip
- **快速**：基于状态机的流式解析
- **规范**：100% CommonMark 兼容

## 代码示例

\`\`\`javascript
import { micromark } from 'micromark';

const html = micromark('# Hello');
console.log(html);  // <h1>Hello</h1>
\`\`\`

## 表格

| 特性 | 支持 |
|------|------|
| CommonMark | ✅ |
| GFM | 扩展 |
| 流式处理 | ✅ |

## 链接

了解更多：[micromark](https://github.com/micromark/micromark)
`;

console.log('=== micromark 渲染结果 ===\n');
console.log(micromark(markdown));

console.log('\n=== 体积对比 ===');
console.log('micromark: ~15KB');
console.log('marked:    ~25KB');
console.log('markdown-it: ~45KB');
