import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// 读取 HTML 文件
const htmlPath = path.join(__dirname, 'testUI.html');
let htmlContent = fs.readFileSync(htmlPath, 'utf8');

// 1. 删除 Response Display 组件（保留组件定义，因为可能被其他地方引用）
// 但我们会让 showResponse 函数不再更新 response state

// 2. 删除响应结果显示部分
// 查找并删除从 {/* Response Display */} 到 </div> 的部分
const responseDisplayRegex = /\s*\{\/\* Response Display \*\/\}[\s\S]*?<\/div>\s*<\/div>\s*<\/div>\s*(?=\{\/\* Debug Console \*\/\})/;
htmlContent = htmlContent.replace(responseDisplayRegex, '\n                    </div>\n                    ');

// 3. 删除 response state 的定义
htmlContent = htmlContent.replace(
    'const [response, setResponse] = useState({ data: null, status: null });',
    '// Response state removed - using Debug Console instead'
);

// 4. 修改 showResponse 函数，只记录到 Debug Console
const oldShowResponse = /\/\/ Show response and record in history\s*\n\s*const showResponse = \(data, status, requestInfo = null\) => \{[\s\S]*?\n\s*\};/;
const newShowResponse = `// Show response and record in history
            const showResponse = (data, status, requestInfo = null) => {
                // Add to request history
                if (requestInfo || true) { // Always record to history
                    const historyEntry = {
                        id: Date.now(),
                        timestamp: new Date().toLocaleString('zh-CN'),
                        method: requestInfo?.method || 'GET',
                        url: requestInfo?.url || '',
                        status: status,
                        requestBody: requestInfo?.body,
                        responseData: data,
                        duration: requestInfo?.duration || 0
                    };
                    
                    requestHistoryRef.current = [historyEntry, ...requestHistoryRef.current].slice(0, 100);
                    setRequestsHistory([...requestHistoryRef.current]);
                }
                
                if (status >= 200 && status < 300) {
                    showToast('请求成功', 'success');
                } else {
                    showToast('请求失败', 'error');
                }
            };`;

htmlContent = htmlContent.replace(oldShowResponse, newShowResponse);

// 5. 删除传递给组件的 showResponse props 中的 response 相关内容
// 由于不再需要显示响应，我们只需要保留 showResponse 用于记录到 Debug Console

// 保存修改后的文件
fs.writeFileSync(htmlPath, htmlContent, 'utf8');

console.log('✅ 响应结果部分已删除');
console.log('📋 修改内容：');
console.log('  - 删除了响应结果显示区域');
console.log('  - 删除了 response state');
console.log('  - 修改了 showResponse 函数，只记录到 Debug Console');
console.log('\n下一步：运行 npm run build:testui 重新生成 TypeScript 文件');