import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';
import { visit } from 'unist-util-visit';

const markdown = `
# remark / unified 测试

## AST 处理示例

这是一个 [链接](https://unifiedjs.com) 和 **粗体文本**。

## 表格

| 处理器 | 用途 |
|--------|------|
| remark | Markdown |
| rehype | HTML |
| retext | 自然语言 |

## 代码块

\`\`\`javascript
// 这是 AST 节点示例
{
  type: 'heading',
  depth: 1,
  children: [{ type: 'text', value: 'Hello' }]
}
\`\`\`

## 任务列表

- [x] 学习 unified
- [x] 掌握 AST
- [ ] 编写插件
`;

console.log('=== 1. 基础渲染 ===\n');

const result = await unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(remarkRehype)
  .use(rehypeStringify)
  .process(markdown);

console.log(String(result));

console.log('\n=== 2. AST 分析 ===\n');

const tree = unified()
  .use(remarkParse)
  .use(remarkGfm)
  .parse(markdown);

// 统计节点
let linkCount = 0;
let headingCount = 0;
let codeCount = 0;

visit(tree, (node) => {
  if (node.type === 'link') linkCount++;
  if (node.type === 'heading') headingCount++;
  if (node.type === 'code') codeCount++;
});

console.log(`链接数量: ${linkCount}`);
console.log(`标题数量: ${headingCount}`);
console.log(`代码块数量: ${codeCount}`);

console.log('\n=== 3. 自定义插件示例 ===\n');

// 一个简单的插件：给所有外部链接添加 target="_blank"
function externalLinks() {
  return (tree) => {
    visit(tree, 'link', (node) => {
      if (node.url.startsWith('http')) {
        node.data = { hProperties: { target: '_blank', rel: 'noopener' } };
      }
    });
  };
}

const result2 = await unified()
  .use(remarkParse)
  .use(remarkGfm)
  .use(externalLinks)
  .use(remarkRehype)
  .use(rehypeStringify)
  .process('[外部链接](https://example.com)');

console.log(String(result2));
