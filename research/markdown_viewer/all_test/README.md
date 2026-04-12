# Markdown Viewer 测试导航

本目录提供一个统一的导航界面，方便快速访问各个 Markdown 渲染库的测试页面。

## 快速开始

```bash
cd research/markdown_viewer/all_test
npx serve .
```

然后访问 `http://localhost:3000`

## 导航功能

- 📊 **对比卡片** - 一目了然查看各库的核心指标
- 🎯 **快速跳转** - 点击卡片直接进入测试页面
- 🏷️ **标签分类** - 了解各库的特点和适用场景

## 推荐的库

| 库 | 适用场景 | 链接 |
|----|---------|------|
| **marked.js** | Chrome 扩展 | [测试页面](../marked_test/test.html) |
| **markdown-it** | Web 应用 | [测试页面](../markdown_it_test/test.html) |
| **remark** | 复杂文档处理 | [测试页面](../remark_test/test.html) |
| **micromark** | 极致体积 | [测试页面](../micromark_test/test.html) |
| **showdown** | 遗留项目 | [测试页面](../showdown_test/test.html) |

## 测试功能

每个测试页面都支持：
- ✏️ 左侧编辑 Markdown
- 👁️ 右侧实时预览 HTML
- ⏱️ 显示渲染耗时
- 🎨 GitHub 风格样式
