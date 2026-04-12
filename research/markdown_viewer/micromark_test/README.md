# micromark 测试

## 安装

```bash
npm install micromark
```

## 快速开始

micromark 是一个低级别的、符合规范、快速、小型的 Markdown 解析器。

```javascript
import { micromark } from 'micromark';

const html = micromark('# Hello World\n\nThis is **bold**.');
console.log(html);
```

## 与 remark 的关系

micromark 是 remark 的底层解析器：

```
remark (高层 API)
  ↓
mdast-util-from-markdown (AST 构建)
  ↓
micromark (词法解析)
```

## 特点

- **极小体积** (~15KB)
- **流式处理** - 支持分块输入
- **100% CommonMark** 兼容
- **零依赖**

## 使用场景

- 嵌入式设备
- 对体积极度敏感的项目
- 需要流式处理的场景
- 构建自己的 Markdown 处理器

## 运行测试

打开 `test.html` 查看浏览器效果。

## 参考

- GitHub: https://github.com/micromark/micromark
- 文档: https://github.com/micromark/micromark#readme
