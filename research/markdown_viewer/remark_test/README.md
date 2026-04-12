# remark / unified 测试

## 安装

```bash
npm install unified remark-parse remark-gfm remark-rehype rehype-stringify
```

## 快速开始

```javascript
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';

const result = await unified()
  .use(remarkParse)      // 解析 Markdown
  .use(remarkGfm)        // GFM 支持
  .use(remarkRehype)     // 转换为 HTML AST
  .use(rehypeStringify)  // 输出 HTML
  .process('# Hello World');

console.log(String(result));
```

## 核心概念

unified 是一个文本处理框架：
- **remark** - Markdown 处理器
- **rehype** - HTML 处理器
- **retext** - 自然语言处理器
- **redot** - Graphviz 处理器

## AST 操作

```javascript
import { visit } from 'unist-util-visit';

// 遍历所有链接
visit(tree, 'link', (node) => {
  console.log(node.url);
});
```

## 运行测试

```bash
npm install
node demo.js
```

或打开 `test.html` 查看浏览器效果。

## 特性测试

- [x] AST 操作
- [x] 插件管道
- [x] GFM / MDX
- [x] Lint 能力
- [x] 500+ 插件生态

## 参考

- 官网: https://unifiedjs.com/
- GitHub: https://github.com/remarkjs/remark
- 插件: https://github.com/remarkjs/awesome-remark
