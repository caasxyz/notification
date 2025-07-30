# Test UI 模块

这个目录包含了通知系统的测试 UI 界面。

## 文件结构

- `testUI.html` - 原始的 HTML 文件，包含完整的 React 应用
- `testUIHtml.ts` - 自动生成的 TypeScript 模块，用于在 Cloudflare Workers 中使用

## 为什么这样设计？

由于 Cloudflare Workers 环境的限制：
1. 不支持文件系统 API（无法使用 `fs.readFileSync`）
2. 所有资源必须在构建时打包
3. 需要将 HTML 作为字符串导入

因此，我们使用构建脚本将 HTML 转换为 TypeScript 模块。

## 如何维护

### 修改 UI

1. 编辑 `testUI.html` 文件
2. 运行构建脚本：
   ```bash
   npm run build:testui
   ```
3. 这会自动更新 `testUIHtml.ts` 文件

### 注意事项

- **不要手动编辑** `testUIHtml.ts` 文件，它是自动生成的
- 所有 UI 修改都应该在 `testUI.html` 中进行
- 构建脚本会自动处理特殊字符的转义

## 构建脚本

构建脚本位于 `scripts/build-testui.js`，它会：
1. 读取 `testUI.html` 文件
2. 转义特殊字符（反斜杠、反引号、模板字符串占位符）
3. 生成一个导出 `getTestUIHTML()` 函数的 TypeScript 模块

## 未来改进

如果需要更复杂的构建流程，可以考虑：
1. 使用 webpack 或 esbuild 来打包资源
2. 将 React 组件拆分成单独的模块
3. 添加 CSS 和 JavaScript 的压缩优化
4. 实现模板引擎来处理动态内容