# marked.js 测试

## 安装

```bash
npm install marked marked-highlight highlight.js
```

## 快速开始

### Node.js
```javascript
const { marked } = require('marked');

const markdown = '# Hello World\n\nThis is **bold** text.';
const html = marked.parse(markdown);
console.log(html);
```

### 浏览器 (ES Module)
```html
<script type="module">
import { marked } from 'https://cdn.jsdelivr.net/npm/marked@15/lib/marked.esm.js';

document.getElementById('output').innerHTML = marked.parse('# Hello');
</script>
```

### 浏览器 (UMD)
```html
<script src="https://cdn.jsdelivr.net/npm/marked@15/marked.min.js"></script>
<script>
document.getElementById('output').innerHTML = marked.parse('# Hello');
</script>
```

## 运行测试

打开 `test.html` 在浏览器中查看渲染效果。

## 特性测试

- [x] 基础语法（标题、段落、列表）
- [x] GFM 扩展（表格、任务列表）
- [x] 代码高亮
- [x] XSS 防护
- [x] 自定义渲染器

## 参考

- 文档: https://marked.js.org/
- GitHub: https://github.com/markedjs/marked
