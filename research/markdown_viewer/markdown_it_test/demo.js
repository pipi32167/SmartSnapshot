const MarkdownIt = require('markdown-it');

// 创建实例（安全模式）
const md = new MarkdownIt({
  html: false,
  linkify: true,
  typographer: true
});

const markdown = `
# markdown-it Demo

## 安全特性示例

尝试输入 <script>alert('xss')</script> - 它会被转义。

## 链接自动识别

访问 https://github.com/markdown-it/markdown-it 了解更多。

## 表格

| 功能 | 支持 |
|------|------|
| CommonMark | ✅ 100% |
| GFM | ✅ |
| 插件 | ✅ 200+ |

## 代码块

\`\`\`javascript
const md = new MarkdownIt();
console.log(md.render('# Hello'));
\`\`\`
`;

console.log('=== markdown-it 渲染结果 ===\n');
console.log(md.render(markdown));

// 性能测试
console.log('\n=== 性能测试 ===');
const start = Date.now();
for (let i = 0; i < 1000; i++) {
  md.render(markdown);
}
const end = Date.now();
console.log(`渲染 1000 次耗时: ${end - start} ms`);
