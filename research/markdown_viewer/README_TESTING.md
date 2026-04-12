# Markdown Viewer 测试指南

本目录包含 5 个主流 Markdown 渲染库的测试项目。

## 快速开始

### 浏览器测试（推荐）

每个测试目录都包含 `test.html`，可以直接在浏览器中打开：

```bash
# 1. 进入任意测试目录
cd marked_test

# 2. 启动本地服务器
npx serve .

# 3. 浏览器打开 http://localhost:3000/test.html
```

### Node.js 测试

```bash
# 1. 进入测试目录
cd marked_test

# 2. 安装依赖
npm install

# 3. 运行 demo
npm test
```

## 测试项目列表

| 目录 | 库 | 体积 | 特点 | 推荐指数 |
|------|-----|------|------|----------|
| [marked_test](./marked_test/) | marked.js | ~25KB | 极速、零依赖 | ⭐⭐⭐⭐⭐ |
| [markdown_it_test](./markdown_it_test/) | markdown-it | ~45KB | 功能全、安全好 | ⭐⭐⭐⭐ |
| [remark_test](./remark_test/) | remark/unified | ~80KB+ | AST 操作、生态强 | ⭐⭐⭐ |
| [micromark_test](./micromark_test/) | micromark | ~15KB | 体积极小 | ⭐⭐⭐ |
| [showdown_test](./showdown_test/) | showdown | ~35KB | 历史悠久 | ⭐⭐ |

## 测试功能

每个测试页面都支持：

1. **实时预览** - 左侧编辑 Markdown，右侧显示 HTML
2. **渲染计时** - 显示渲染耗时
3. **完整语法** - 标题、列表、表格、代码、链接等
4. **特性展示** - 各库特有的功能

## 对比维度

| 维度 | 说明 |
|------|------|
| **体积** | 压缩后的 gzip 大小 |
| **性能** | 大文件渲染速度 |
| **功能** | GFM、表格、任务列表、脚注等 |
| **安全** | XSS 防护能力 |
| **生态** | 插件数量和丰富度 |
| **维护** | GitHub 活跃度和更新频率 |

## 推荐选择

### Chrome 扩展 / 体积敏感 → marked.js
- 25KB，零依赖
- 速度快，维护活跃
- 通过插件支持 GFM

### Web 应用 / 功能全面 → markdown-it
- 100% CommonMark 兼容
- 内置 XSS 防护
- 200+ 插件

### 复杂文档处理 → remark/unified
- AST 可操作
- 500+ 插件
- 适合构建文档流水线

## 快速对比命令

```bash
# 同时测试所有库（需要安装依赖）
cd marked_test && npm install && node demo.js
cd ../markdown_it_test && npm install && node demo.js
cd ../micromark_test && npm install && node demo.js
cd ../showdown_test && npm install && node demo.js
```

## 浏览器性能测试

在 `test.html` 页面可以测试：

1. **渲染速度** - 实时显示渲染耗时
2. **大文件处理** - 粘贴大段 Markdown 测试
3. **内存占用** - 通过 DevTools Performance 查看

## 参考

- 详细研究报告：[README.md](./README.md)
