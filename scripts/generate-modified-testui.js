const fs = require('fs');
const path = require('path');

// 读取原始 HTML 文件
const htmlPath = path.join(__dirname, '../src/ui/testUI.html');
let htmlContent = fs.readFileSync(htmlPath, 'utf8');

// 在 App 组件的状态定义部分添加请求历史状态
htmlContent = htmlContent.replace(
    'const [templatesData, setTemplatesData] = useState({});',
    `const [templatesData, setTemplatesData] = useState({});
            const [requestsHistory, setRequestsHistory] = useState([]);
            const requestHistoryRef = useRef([]);`
);

// 修改 showResponse 函数
htmlContent = htmlContent.replace(
    /\/\/ Show response\s*\n\s*const showResponse = \(data, status\) => \{[\s\S]*?\};/,
    `// Show response and record in history
            const showResponse = (data, status, requestInfo = null) => {
                const envInfo = environment === 'production' ? 
                    '⚠️ 正式环境响应\\n' + '━'.repeat(50) + '\\n' : 
                    '✅ 本地环境响应\\n' + '━'.repeat(50) + '\\n';
                
                setResponse({
                    data: envInfo + JSON.stringify(data, null, 2),
                    status
                });
                
                // Add to request history
                if (requestInfo) {
                    const historyEntry = {
                        id: Date.now(),
                        timestamp: new Date().toLocaleString('zh-CN'),
                        method: requestInfo.method || 'GET',
                        url: requestInfo.url,
                        status: status,
                        requestBody: requestInfo.body,
                        responseData: data,
                        duration: requestInfo.duration || 0
                    };
                    
                    requestHistoryRef.current = [historyEntry, ...requestHistoryRef.current].slice(0, 100);
                    setRequestsHistory([...requestHistoryRef.current]);
                }
                
                if (status >= 200 && status < 300) {
                    showToast('请求成功', 'success');
                } else {
                    showToast('请求失败', 'error');
                }
            };`
);

// 在 ChannelSelector 组件后添加 DebugConsole 组件
const debugConsoleComponent = `
        
        // Debug Console Component
        function DebugConsole({ requests, onClear }) {
            const [isMinimized, setIsMinimized] = useState(false);
            const [filter, setFilter] = useState('all');
            const [selectedRequest, setSelectedRequest] = useState(null);
            
            const filteredRequests = requests.filter(req => {
                if (filter === 'all') return true;
                if (filter === 'success') return req.status >= 200 && req.status < 300;
                if (filter === 'error') return req.status >= 400 || req.status === 0;
                return true;
            });
            
            return (
                <div className={\`fixed bottom-0 left-0 right-0 bg-white border-t-2 border-gray-300 shadow-2xl transition-all z-50 \${isMinimized ? 'h-12' : 'h-80'}\`}>
                    <div className="flex justify-between items-center p-3 bg-gray-800 text-white">
                        <h3 className="font-bold flex items-center gap-2">
                            <Icon name="terminal" />
                            Debug Console ({filteredRequests.length})
                        </h3>
                        <div className="flex gap-2 items-center">
                            <select 
                                value={filter} 
                                onChange={(e) => setFilter(e.target.value)}
                                className="px-2 py-1 rounded text-gray-800 text-sm"
                            >
                                <option value="all">全部</option>
                                <option value="success">成功</option>
                                <option value="error">错误</option>
                            </select>
                            <button 
                                onClick={onClear}
                                className="px-3 py-1 bg-red-600 hover:bg-red-700 rounded text-sm"
                            >
                                清空
                            </button>
                            <button 
                                onClick={() => setIsMinimized(!isMinimized)}
                                className="px-3 py-1 bg-gray-600 hover:bg-gray-700 rounded text-sm"
                            >
                                <Icon name={isMinimized ? 'chevron-up' : 'chevron-down'} />
                            </button>
                        </div>
                    </div>
                    {!isMinimized && (
                        <div className="flex h-full">
                            {/* Request List */}
                            <div className="w-1/3 border-r overflow-y-auto">
                                {filteredRequests.map(req => (
                                    <div 
                                        key={req.id}
                                        className={\`p-3 border-b cursor-pointer hover:bg-gray-50 \${selectedRequest?.id === req.id ? 'bg-blue-50' : ''}\`}
                                        onClick={() => setSelectedRequest(req)}
                                    >
                                        <div className="flex items-center gap-2">
                                            <span className={\`badge \${req.status >= 200 && req.status < 300 ? 'badge-success' : 'badge-error'} text-xs\`}>
                                                {req.method}
                                            </span>
                                            <span className="text-xs text-gray-500">{req.timestamp}</span>
                                        </div>
                                        <div className="text-sm font-mono truncate mt-1">
                                            {req.url.replace(window.location.origin, '')}
                                        </div>
                                        <div className="flex items-center gap-2 mt-1">
                                            <span className={\`text-xs \${req.status >= 200 && req.status < 300 ? 'text-green-600' : 'text-red-600'}\`}>
                                                {req.status || 'Failed'}
                                            </span>
                                            <span className="text-xs text-gray-500">{req.duration}ms</span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                            
                            {/* Request Details */}
                            <div className="flex-1 overflow-y-auto p-4">
                                {selectedRequest ? (
                                    <div className="space-y-4">
                                        <div>
                                            <h4 className="font-bold mb-2">请求详情</h4>
                                            <div className="bg-gray-100 p-3 rounded">
                                                <div className="text-sm space-y-1">
                                                    <div><strong>URL:</strong> {selectedRequest.url}</div>
                                                    <div><strong>方法:</strong> {selectedRequest.method}</div>
                                                    <div><strong>状态:</strong> {selectedRequest.status || 'Failed'}</div>
                                                    <div><strong>耗时:</strong> {selectedRequest.duration}ms</div>
                                                </div>
                                            </div>
                                        </div>
                                        
                                        {selectedRequest.requestBody && (
                                            <div>
                                                <h4 className="font-bold mb-2">请求体</h4>
                                                <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto max-h-40">
                                                    {typeof selectedRequest.requestBody === 'string' 
                                                        ? JSON.stringify(JSON.parse(selectedRequest.requestBody), null, 2)
                                                        : JSON.stringify(selectedRequest.requestBody, null, 2)}
                                                </pre>
                                            </div>
                                        )}
                                        
                                        <div>
                                            <h4 className="font-bold mb-2">响应</h4>
                                            <pre className="bg-gray-100 p-3 rounded text-xs overflow-auto max-h-40">
                                                {JSON.stringify(selectedRequest.responseData, null, 2)}
                                            </pre>
                                        </div>
                                    </div>
                                ) : (
                                    <div className="text-center text-gray-500 mt-8">
                                        选择一个请求查看详情
                                    </div>
                                )}
                            </div>
                        </div>
                    )}
                </div>
            );
        }`;

// 在 QuickFillButtons 组件后添加 DebugConsole
htmlContent = htmlContent.replace(
    '// Main App Component',
    debugConsoleComponent + '\n\n        // Main App Component'
);

// 在 Toast 组件前添加 DebugConsole
htmlContent = htmlContent.replace(
    '{/* Toast Notification */}',
    `{/* Debug Console */}
                    <DebugConsole 
                        requests={requestsHistory} 
                        onClear={() => {
                            requestHistoryRef.current = [];
                            setRequestsHistory([]);
                            showToast('调试记录已清空', 'info');
                        }}
                    />
                    
                    {/* Toast Notification */}`
);

// 保存修改后的 HTML 文件
const modifiedHtmlPath = path.join(__dirname, '../src/ui/testUI-modified.html');
fs.writeFileSync(modifiedHtmlPath, htmlContent, 'utf8');

console.log('Modified HTML file created at:', modifiedHtmlPath);
console.log('Next step: Run npm run build:testui to generate the TypeScript file');