# Markdown Viewer 开源项目研究报告

> 研究时间：2026-04-11
> 
> 研究目标：为 SmartSnapshot 扩展选择合适的 Markdown 渲染方案

## 目录

1. [概述](#概述)
2. [主流库详细评测](#主流库详细评测)
3. [功能对比表](#功能对比表)
4. [推荐建议](#推荐建议)
5. [参考链接](#参考链接)

---

## 概述

Markdown 渲染库主要分为以下几类：

| 类型 | 代表库 | 特点 |
|------|--------|------|
| **高速渲染器** | marked.js, micromark | 速度快、体积小 |
| **可扩展渲染器** | markdown-it, remark | 插件丰富、生态强大 |
| **老牌渲染器** | showdown.js | 历史悠久、兼容性好 |

对于 Chrome 扩展场景，需重点考虑：
- **体积**：扩展包大小限制
- **安全**：XSS 防护能力
- **性能**：渲染速度
- **GFM 支持**：GitHub Flavored Markdown

---

## 主流库详细评测

### 1. marked.js ⭐ 推荐

**GitHub**: https://github.com/markedjs/marked

#### 基本信息
| 属性 | 数据 |
|------|------|
| Stars | 33,000+ |
| 版本 | v15.x (活跃维护) |
| 压缩体积 | ~25KB (gzip) |
| 依赖 | 0 (零依赖) |
| License | MIT |

#### 功能特性
- ✅ CommonMark 和 GFM 规范支持
- ✅ 可扩展的 Renderer
- ✅ 内置 Lexer（词法分析）
- ✅ 同步/异步渲染
- ✅ TypeScript 支持
- ✅ 浏览器 + Node.js

#### 扩展插件
```javascript
// 代码高亮
marked.use(markedHighlight({
  langPrefix: 'hljs language-',
  highlight: (code, lang) => hljs.highlight(code, { language: lang }).value
}));

// GFM 扩展
marked.use(markedGfm());
```

#### 性能测试
| 场景 | 速度 |
|------|------|
| 小文件 (< 10KB) | 极快 |
| 中文件 (100KB) | 快 |
| 大文件 (1MB) | 中等 |

#### 优缺点
| 优点 | 缺点 |
|------|------|
| 速度极快 | 默认配置较简单 |
| 零依赖 | 高级功能需插件 |
| 社区活跃 | - |
| 文档完善 | - |

---

### 2. markdown-it

**GitHub**: https://github.com/markdown-it/markdown-it

#### 基本信息
| 属性 | 数据 |
|------|------|
| Stars | 18,000+ |
| 版本 | v14.x (活跃维护) |
| 压缩体积 | ~45KB (gzip) |
| 依赖 | 0 (零依赖) |
| License | MIT |

#### 功能特性
- ✅ 100% CommonMark 支持，通过全部测试
- ✅ 丰富的插件生态（200+）
- ✅ 安全模式（XSS 防护）
- ✅ 预设配置（commonmark, default, zero）
- ✅ 插件链式调用
- ✅ TypeScript 支持

#### 常用插件
```javascript
const md = require('markdown-it')()
  .use(require('markdown-it-emoji'))        // Emoji
  .use(require('markdown-it-highlightjs'))  // 代码高亮
  .use(require('markdown-it-task-lists'))   // 任务列表
  .use(require('markdown-it-footnote'))     // 脚注
  .use(require('markdown-it-anchor'));      // 锚点
```

#### 安全特性
```javascript
// 禁用 HTML（防 XSS）
const md = require('markdown-it')({
  html: false,
  linkify: true,
  typographer: true
});
```

#### 优缺点
| 优点 | 缺点 |
|------|------|
| 插件生态最丰富 | 体积比 marked 大 |
| 安全性好 | 配置较复杂 |
| 符合规范 | 速度略慢于 marked |
| 可定制性强 | - |

---

### 3. remark / unified

**GitHub**: https://github.com/remarkjs/remark

#### 基本信息
| 属性 | 数据 |
|------|------|
| Stars | 8,000+ |
| 版本 | v15.x (活跃维护) |
| 压缩体积 | ~80KB+ (生态庞大) |
| 依赖 | 较多（模块化设计） |
| License | MIT |

#### 架构特点
unified 是一个文本处理框架，remark 是基于它的 Markdown 处理器：

```
unified (框架)
  ├── remark (Markdown)
  ├── rehype (HTML)
  ├── retext (自然语言)
  └── redot (Graphviz)
```

#### 功能特性
- ✅ AST（抽象语法树）操作
- ✅ 强大的转换管道
- ✅ 500+ 插件生态
- ✅ lint 能力（remark-lint）
- ✅ 支持 MDX

#### 使用示例
```javascript
import { unified } from 'unified';
import remarkParse from 'remark-parse';
import remarkGfm from 'remark-gfm';
import remarkRehype from 'remark-rehype';
import rehypeStringify from 'rehype-stringify';

const result = await unified()
  .use(remarkParse)      // 解析 Markdown
  .use(remarkGfm)        // GFM 支持
  .use(remarkRehype)     // 转 HTML AST
  .use(rehypeStringify)  // 输出 HTML
  .process('# Hello');
```

#### 优缺点
| 优点 | 缺点 |
|------|------|
| 功能最强大 | 体积大 |
| AST 可操作 | 学习曲线陡峭 |
| 生态最全 | 配置复杂 |
| 适合复杂场景 | 不适合简单场景 |

---

### 4. micromark

**GitHub**: https://github.com/micromark/micromark

#### 基本信息
| 属性 | 数据 |
|------|------|
| Stars | 2,000+ |
| 版本 | v4.x (活跃维护) |
| 压缩体积 | ~15KB (core) |
| 依赖 | 0 |
| License | MIT |

#### 特点
- 基于状态机的流式解析器
- 100% CommonMark 兼容
- 为 remark 提供底层支持
- 内存占用小

#### 优缺点
| 优点 | 缺点 |
|------|------|
| 体积极小 | 功能基础 |
| 速度极快 | 需配合其他库使用 |
| 流式处理 | 不适合直接使用 |
| 规范兼容好 | - |

---

### 5. showdown.js

**GitHub**: https://github.com/showdownjs/showdown

#### 基本信息
| 属性 | 数据 |
|------|------|
| Stars | 13,000+ |
| 版本 | v2.x (维护放缓) |
| 压缩体积 | ~35KB (gzip) |
| 依赖 | 0 |
| License | MIT |

#### 特点
- 历史悠久（2012年发布）
- 兼容多种 Markdown 方言
- 可扩展的 sub-parser

#### 优缺点
| 优点 | 缺点 |
|------|------|
| 历史悠久 | 维护不如从前活跃 |
| 兼容性好 | 性能一般 |
| 配置丰富 | 不符合 CommonMark |

---

## 功能对比表

| 特性 | marked.js | markdown-it | remark | micromark | showdown |
|------|-----------|-------------|--------|-----------|----------|
| **体积 (gzip)** | ~25KB | ~45KB | ~80KB+ | ~15KB | ~35KB |
| **Stars** | 33k+ | 18k+ | 8k+ | 2k+ | 13k+ |
| **CommonMark** | ✅ | ✅✅ | ✅✅ | ✅✅ | ❌ |
| **GFM** | ✅ | ✅ | ✅ | 插件 | 插件 |
| **TypeScript** | ✅ | ✅ | ✅ | ✅ | ✅ |
| **XSS 防护** | 需配置 | ✅ 内置 | 需配置 | 需配置 | 需配置 |
| **插件生态** | 中等 | 丰富 | 极丰富 | 基础 | 中等 |
| **代码高亮** | 插件 | 插件 | 插件 | 插件 | 插件 |
| **数学公式** | 插件 | 插件 | 插件 | 插件 | 插件 |
| **任务列表** | 插件 | ✅ | ✅ | 插件 | 插件 |
| **脚注** | ❌ | ✅ | ✅ | ❌ | 插件 |
| **维护活跃度** | 高 | 高 | 高 | 高 | 中 |

---

## 推荐建议

### 场景一：Chrome 扩展（SmartSnapshot）⭐ 推荐 marked.js

**理由**：
1. **体积小** (~25KB)：扩展包大小敏感
2. **零依赖**：减少打包复杂度
3. **速度快**：渲染性能优秀
4. **GFM 支持**：通过插件支持 GitHub 风格
5. **维护活跃**：长期支持有保障

**集成方案**：
```javascript
// 打包时引入
import { marked } from 'marked';
import { markedHighlight } from 'marked-highlight';
import hljs from 'highlight.js';

marked.use(markedHighlight({
  highlight: (code, lang) => {
    const language = hljs.getLanguage(lang) ? lang : 'plaintext';
    return hljs.highlight(code, { language }).value;
  }
}));

// 渲染
const html = marked.parse(markdownContent);
```

---

### 场景二：需要丰富插件和安全性

**推荐 markdown-it**

**理由**：
1. **安全模式**：内置 XSS 防护
2. **插件丰富**：200+ 插件可选
3. **规范兼容**：100% CommonMark

---

### 场景三：复杂文档处理（AST 操作）

**推荐 remark/unified**

**理由**：
1. **AST 操作**：可编程处理文档结构
2. **管道处理**：复杂转换流程
3. **生态最全**：500+ 插件

**但不适合**：简单的渲染场景（体积过大）

---

### 场景四：极致体积敏感

**推荐 micromark + 自定义渲染**

**理由**：
- 核心仅 ~15KB
- 流式处理，内存友好

---

## 总结

| 使用场景 | 推荐库 | 理由 |
|----------|--------|------|
| Chrome 扩展 | **marked.js** | 体积小、速度快、零依赖 |
| Web 应用 | **markdown-it** | 功能全、安全好 |
| 复杂文档处理 | **remark** | AST 操作、生态强 |
| 嵌入式/IoT | **micromark** | 体积极小 |
| 遗留项目 | **showdown** | 兼容旧代码 |

---

## 参考链接

### 官方仓库
- marked.js: https://github.com/markedjs/marked
- markdown-it: https://github.com/markdown-it/markdown-it
- remark: https://github.com/remarkjs/remark
- micromark: https://github.com/micromark/micromark
- showdown: https://github.com/showdownjs/showdown

### 文档
- marked.js Docs: https://marked.js.org/
- markdown-it Demo: https://markdown-it.github.io/
- unified Ecosystem: https://unifiedjs.com/

### 对比工具
- Benchmark: https://github.com/markdown-it/markdown-it/tree/master/benchmark
- CommonMark Test: https://spec.commonmark.org/

---

*报告生成时间：2026-04-11*
