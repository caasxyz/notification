#!/usr/bin/env node
/**
 * 构建脚本：将 Test UI HTML 转换为 TypeScript 模块
 * 
 * 这个脚本读取 src/ui/testUI.html 文件，
 * 并生成一个可以在 Cloudflare Workers 中使用的 TypeScript 模块
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 文件路径
const htmlPath = path.join(__dirname, '../src/ui/testUI.html');
const outputPath = path.join(__dirname, '../src/ui/testUIHtml.ts');

// 读取 HTML 文件
const htmlContent = fs.readFileSync(htmlPath, 'utf-8');

// 转义模板字符串中的特殊字符
const escapedHtml = htmlContent
  .replace(/\\/g, '\\\\')  // 转义反斜杠
  .replace(/`/g, '\\`')    // 转义反引号
  .replace(/\${/g, '\\${'); // 转义模板字符串占位符

// 生成 TypeScript 模块内容
const tsContent = `/**
 * Test UI HTML Content
 * 
 * 自动生成的文件，请勿手动编辑！
 * 如需修改，请编辑 src/ui/testUI.html 然后运行 npm run build:testui
 * 
 * Generated at: ${new Date().toISOString()}
 */

/**
 * 获取 Test UI 的 HTML 内容
 */
export function getTestUIHTML(): string {
  return \`${escapedHtml}\`;
}
`;

// 写入输出文件
fs.writeFileSync(outputPath, tsContent, 'utf-8');

console.log('✅ Test UI HTML 已成功转换为 TypeScript 模块');
console.log(`📄 输出文件: ${outputPath}`);