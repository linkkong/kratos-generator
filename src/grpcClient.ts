import * as vscode from 'vscode';
import * as cp from 'child_process';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { generateRequestExample } from './protoParser';
import { ServiceInfo, MethodInfo, UrlInfo } from './protoTypes';
import * as grpc from '@grpc/grpc-js';
import * as protoLoader from '@grpc/proto-loader';
import axios from 'axios';
import { generateUrlInfo, validateHost, formatHost } from './urlGenerator';
import { generateRequestTemplate, formatRequestTemplate } from './requestTemplateGenerator';

export class GrpcClientPanel {
    public static currentPanel: GrpcClientPanel | undefined;
    private static readonly viewType = 'grpcClient';
    
    private readonly panel: vscode.WebviewPanel;
    private readonly extensionUri: vscode.Uri;
    private disposables: vscode.Disposable[] = [];
    
    private services: ServiceInfo[] = [];
    private currentService?: ServiceInfo;
    private currentMethod?: MethodInfo;
    private currentHost: string = 'localhost:9000';
    private requestMode: 'grpc' | 'http' = 'grpc';
    private currentUrlInfo?: UrlInfo;
    
    public static createOrShow(extensionUri: vscode.Uri, services: ServiceInfo[], service?: ServiceInfo, method?: MethodInfo) {
        const column = vscode.window.activeTextEditor
            ? vscode.window.activeTextEditor.viewColumn
            : undefined;
        
        // 如果已经打开了面板，直接显示
        if (GrpcClientPanel.currentPanel) {
            GrpcClientPanel.currentPanel.panel.reveal(column);
            if (service && method) {
                GrpcClientPanel.currentPanel.updateMethod(service, method);
            }
            return;
        }
        
        // 否则创建新面板
        const panel = vscode.window.createWebviewPanel(
            GrpcClientPanel.viewType,
            'gRPC 客户端',
            column || vscode.ViewColumn.One,
            {
                enableScripts: true,
                retainContextWhenHidden: true,
                localResourceRoots: [
                    vscode.Uri.joinPath(extensionUri, 'media')
                ]
            }
        );
        
        GrpcClientPanel.currentPanel = new GrpcClientPanel(panel, extensionUri, services);
        
        // 如果提供了服务和方法，设置为当前方法
        if (service && method) {
            GrpcClientPanel.currentPanel.updateMethod(service, method);
        }
    }
    
    private constructor(panel: vscode.WebviewPanel, extensionUri: vscode.Uri, services: ServiceInfo[]) {
        this.panel = panel;
        this.extensionUri = extensionUri;
        this.services = services;
        
        // 从配置中获取默认主机
        const config = vscode.workspace.getConfiguration('kratosProtoGenerator');
        this.currentHost = config.get<string>('grpcDefaultHost') || 'localhost:9000';
        
        // 设置 webview 内容
        this.update();
        
        // 监听面板关闭事件
        this.panel.onDidDispose(() => this.dispose(), null, this.disposables);
        
        // 监听 webview 消息
        this.panel.webview.onDidReceiveMessage(
            message => {
                switch (message.command) {
                    case 'selectService':
                        this.handleSelectService(message.serviceIndex);
                        return;
                    case 'selectMethod':
                        this.handleSelectMethod(message.methodIndex);
                        return;
                    case 'updateHost':
                        this.handleUpdateHost(message.host);
                        return;
                    case 'executeRequest':
                        this.executeRequest(message.request);
                        return;
                    case 'updateRequestMode':
                        this.requestMode = message.mode;
                        return;
                }
            },
            null,
            this.disposables
        );
    }
    
    // 处理主机地址更新
    private async handleUpdateHost(host: string) {
        this.currentHost = formatHost(host);
        
        // 重新生成URL信息
        if (this.currentService && this.currentMethod) {
            this.currentUrlInfo = generateUrlInfo(this.currentService, this.currentMethod, this.currentHost);
            await this.update();
        }
    }
    
    // 处理选择服务
    private handleSelectService(serviceIndex: number) {
        if (serviceIndex >= 0 && serviceIndex < this.services.length) {
            this.currentService = this.services[serviceIndex];
            this.currentMethod = undefined;
            this.currentUrlInfo = undefined;
            this.update();
        }
    }
    
    // 处理选择方法
    private async handleSelectMethod(methodIndex: number) {
        if (this.currentService && methodIndex >= 0 && methodIndex < this.currentService.methods.length) {
            this.currentMethod = this.currentService.methods[methodIndex];
            
            // 生成URL信息
            if (this.currentMethod) {
                this.currentUrlInfo = generateUrlInfo(this.currentService, this.currentMethod, this.currentHost);
            }
            
            await this.update();
        }
    }
    
    // 更新面板内容
    private async update() {
        if (this.panel.visible) {
            this.panel.webview.html = await this.getHtmlForWebview();
        }
    }
    
    // 更新当前方法
    public async updateMethod(service: ServiceInfo, method: MethodInfo) {
        this.currentService = service;
        this.currentMethod = method;
        
        // 生成URL信息
        this.currentUrlInfo = generateUrlInfo(service, method, this.currentHost);
        
        await this.update();
    }
    
    // 生成 webview HTML
    private async getHtmlForWebview() {
        // 创建服务选择器选项
        const serviceOptions = this.services.map((service, index) => {
            const selected = this.currentService && this.currentService.name === service.name ? 'selected' : '';
            return `<option value="${index}" ${selected}>${service.name} (${path.basename(service.filePath)})</option>`;
        }).join('\n');
        
        // 创建方法选择器选项
        const methodOptions = this.currentService ? this.currentService.methods.map((method, index) => {
            const selected = this.currentMethod && this.currentMethod.name === method.name ? 'selected' : '';
            // 添加 HTTP 信息到选项文本
            const httpInfo = method.hasHttpOption ? 
                ` [HTTP: ${method.httpMethod?.toUpperCase()} ${method.httpPath}]` : '';
            return `<option value="${index}" ${selected}>${method.name}${httpInfo}</option>`;
        }).join('\n') : '';
        
        // 生成URL信息HTML
        const urlInfoHtml = this.currentUrlInfo ? `
            <div class="url-info-container">
                <div class="panel-header">📡 请求地址</div>
                <div class="url-display">
                    <div class="url-item">
                        <strong>gRPC:</strong> <code class="url-text">${this.currentUrlInfo.grpcUrl}</code>
                        <button class="copy-btn" onclick="copyToClipboard('${this.currentUrlInfo.grpcUrl}')">复制</button>
                    </div>
                    ${this.currentUrlInfo.httpUrl ? `
                    <div class="url-item">
                        <strong>HTTP:</strong> <code class="url-text">${this.currentUrlInfo.httpUrl}</code>
                        <button class="copy-btn" onclick="copyToClipboard('${this.currentUrlInfo.httpUrl}')">复制</button>
                    </div>` : ''}
                </div>
            </div>
        ` : '';
        
        // 生成完整的请求参数模板
        let requestTemplate = '{}';
        if (this.currentMethod && this.currentService) {
            try {
                const template = await generateRequestTemplate(this.currentMethod, this.currentService.filePath);
                requestTemplate = formatRequestTemplate(template);
            } catch (error) {
                console.warn('生成请求模板失败，使用默认模板:', error);
                requestTemplate = generateRequestExample(this.currentMethod);
            }
        }
        
        // 检查当前方法是否支持 HTTP
        const supportsHttp = this.currentMethod && 
                            this.currentMethod.hasHttpOption && 
                            this.currentMethod.httpMethod && 
                            this.currentMethod.httpPath;
        
        // 决定是否禁用 HTTP 模式选项
        const httpModeDisabled = !supportsHttp ? 'disabled' : '';
        
        return `<!DOCTYPE html>
        <html lang="zh">
        <head>
            <meta charset="UTF-8">
            <meta name="viewport" content="width=device-width, initial-scale=1.0">
            <title>gRPC/HTTP 客户端</title>
            <style>
                body {
                    font-family: var(--vscode-font-family);
                    padding: 20px;
                    color: var(--vscode-foreground);
                }
                
                select, input, textarea, button {
                    padding: 8px;
                    background-color: var(--vscode-input-background);
                    color: var(--vscode-input-foreground);
                    border: 1px solid var(--vscode-input-border);
                    font-family: var(--vscode-font-family);
                }
                
                select, input {
                    height: 36px;
                    box-sizing: border-box;
                }
                
                textarea {
                    width: 100%;
                    min-height: 300px;
                    resize: vertical;
                    font-family: monospace;
                }
                
                button {
                    background-color: var(--vscode-button-background);
                    color: var(--vscode-button-foreground);
                    border: none;
                    cursor: pointer;
                    padding: 10px 20px;
                    border-radius: 3px;
                    font-weight: bold;
                }
                
                button:hover {
                    background-color: var(--vscode-button-hoverBackground);
                }
                
                button:disabled {
                    opacity: 0.5;
                    cursor: not-allowed;
                }
                
                .container {
                    display: flex;
                    flex-direction: column;
                    gap: 20px;
                    height: 100%;
                }
                
                /* 顶部控制区 */
                .control-row {
                    display: flex;
                    gap: 10px;
                    align-items: center;
                    margin-bottom: 20px;
                }
                
                .control-item {
                    display: flex;
                    flex-direction: column;
                    flex: 1;
                }
                
                .control-item label {
                    margin-bottom: 5px;
                    font-weight: bold;
                }
                
                .control-item select,
                .control-item input {
                    width: 100%;
                }
                
                /* 请求模式选择器 */
                .mode-selector {
                    display: flex;
                    align-items: center;
                    gap: 5px;
                    margin-left: 10px;
                }
                
                .mode-selector label {
                    display: flex;
                    align-items: center;
                    margin-right: 10px;
                    font-weight: normal;
                }
                
                .mode-selector input[type="radio"] {
                    width: auto;
                    height: auto;
                    margin-right: 5px;
                }
                
                /* 请求响应区 */
                .req-res-container {
                    display: flex;
                    gap: 20px;
                    height: 70vh;
                    min-height: 400px;
                }
                
                .request-container, .response-container {
                    flex: 1;
                    display: flex;
                    flex-direction: column;
                }
                
                .panel-header {
                    font-weight: bold;
                    margin-bottom: 5px;
                }
                
                .execute-container {
                    display: flex;
                    flex-direction: column;
                    justify-content: center;
                    align-items: center;
                    padding: 0 10px;
                }
                
                .arrow-icon {
                    font-size: 24px;
                    margin: 10px 0;
                }
                
                #response {
                    background-color: var(--vscode-editor-background);
                    color: var(--vscode-editor-foreground);
                    padding: 10px;
                    border: 1px solid var(--vscode-input-border);
                    flex: 1;
                    overflow: auto;
                    white-space: pre-wrap;
                    font-family: monospace;
                }
                
                #loading {
                    display: none;
                    text-align: center;
                    margin-top: 10px;
                }
                
                .spinner {
                    border: 4px solid rgba(0, 0, 0, 0.1);
                    width: 20px;
                    height: 20px;
                    border-radius: 50%;
                    border-top-color: var(--vscode-progressBar-background);
                    animation: spin 1s linear infinite;
                    display: inline-block;
                    margin: 0 auto;
                }
                
                @keyframes spin {
                    0% { transform: rotate(0deg); }
                    100% { transform: rotate(360deg); }
                }
                
                /* 响应式布局 */
                @media (max-width: 800px) {
                    .control-row {
                        flex-direction: column;
                        align-items: stretch;
                    }
                    
                    .req-res-container {
                        flex-direction: column;
                        height: auto;
                    }
                    
                    .execute-container {
                        flex-direction: row;
                        padding: 10px 0;
                    }
                    
                    .arrow-icon {
                        transform: rotate(90deg);
                        margin: 0 10px;
                    }
                }
                
                /* URL信息显示样式 */
                .url-info-container {
                    margin: 20px 0;
                    padding: 15px;
                    background-color: var(--vscode-editorWidget-background);
                    border: 1px solid var(--vscode-input-border);
                    border-radius: 5px;
                }
                
                .url-display {
                    margin-top: 10px;
                }
                
                .url-item {
                    display: flex;
                    align-items: center;
                    margin-bottom: 10px;
                    gap: 10px;
                }
                
                .url-item:last-child {
                    margin-bottom: 0;
                }
                
                .url-text {
                    background-color: var(--vscode-textCodeBlock-background);
                    color: var(--vscode-textPreformat-foreground);
                    padding: 4px 8px;
                    border-radius: 3px;
                    font-family: monospace;
                    font-size: 12px;
                    word-break: break-all;
                    flex: 1;
                    margin: 0;
                }
                
                .copy-btn {
                    background-color: var(--vscode-button-secondaryBackground);
                    color: var(--vscode-button-secondaryForeground);
                    border: 1px solid var(--vscode-button-border);
                    padding: 4px 8px;
                    font-size: 11px;
                    border-radius: 3px;
                    cursor: pointer;
                    white-space: nowrap;
                }
                
                .copy-btn:hover {
                    background-color: var(--vscode-button-secondaryHoverBackground);
                }
            </style>
        </head>
        <body>
            <div class="container">
                <h1>gRPC/HTTP 客户端</h1>
                
                <div class="control-row">
                    <div class="control-item">
                        <label for="hostInput">主机地址</label>
                        <input type="text" id="hostInput" value="${this.currentHost}" placeholder="例如: localhost:9000" />
                    </div>
                    
                    <div class="control-item">
                        <label for="serviceSelect">服务</label>
                        <select id="serviceSelect">
                            <option value="-1">-- 选择服务 --</option>
                            ${serviceOptions}
                        </select>
                    </div>
                    
                    <div class="control-item">
                        <label for="methodSelect">方法</label>
                        <select id="methodSelect" ${!this.currentService ? 'disabled' : ''}>
                            <option value="-1">-- 选择方法 --</option>
                            ${methodOptions}
                        </select>
                    </div>
                    
                    <div class="mode-selector">
                        <label>
                            <input type="radio" name="requestMode" value="grpc" ${this.requestMode === 'grpc' ? 'checked' : ''} /> 
                            gRPC
                        </label>
                        <label>
                            <input type="radio" name="requestMode" value="http" ${this.requestMode === 'http' ? 'checked' : ''} ${httpModeDisabled} /> 
                            HTTP ${!supportsHttp ? '(不支持)' : ''}
                        </label>
                    </div>
                </div>
                
                ${urlInfoHtml}
                
                <div class="req-res-container">
                    <div class="request-container">
                        <div class="panel-header">请求参数 (JSON)</div>
                        <textarea id="requestInput" placeholder="输入 JSON 格式的请求参数" ${!this.currentMethod ? 'disabled' : ''}>${requestTemplate}</textarea>
                    </div>
                    
                    <div class="execute-container">
                        <button id="executeBtn" ${!this.currentMethod ? 'disabled' : ''}>发送请求</button>
                        <div class="arrow-icon">→</div>
                        <div id="loading">
                            <div class="spinner"></div>
                            <div>请求中...</div>
                        </div>
                    </div>
                    
                    <div class="response-container">
                        <div class="panel-header">响应结果</div>
                        <div id="response"></div>
                    </div>
                </div>
            </div>
            
            <script>
                (function() {
                    const vscode = acquireVsCodeApi();
                    
                    // 复制到剪贴板功能
                    window.copyToClipboard = function(text) {
                        navigator.clipboard.writeText(text).then(() => {
                            // 可以显示成功提示
                            console.log('已复制到剪贴板:', text);
                        }).catch(err => {
                            console.error('复制失败:', err);
                        });
                    };
                    
                    // 获取元素
                    const hostInput = document.getElementById('hostInput');
                    const serviceSelect = document.getElementById('serviceSelect');
                    const methodSelect = document.getElementById('methodSelect');
                    const requestInput = document.getElementById('requestInput');
                    const executeBtn = document.getElementById('executeBtn');
                    const responseOutput = document.getElementById('response');
                    const loadingIndicator = document.getElementById('loading');
                    const requestModeRadios = document.getElementsByName('requestMode');
                    
                    // 监听服务选择变更
                    serviceSelect.addEventListener('change', () => {
                        vscode.postMessage({
                            command: 'selectService',
                            serviceIndex: parseInt(serviceSelect.value)
                        });
                    });
                    
                    // 监听方法选择变更
                    methodSelect.addEventListener('change', () => {
                        vscode.postMessage({
                            command: 'selectMethod',
                            methodIndex: parseInt(methodSelect.value)
                        });
                    });
                    
                    // 监听主机地址变更
                    hostInput.addEventListener('blur', () => {
                        vscode.postMessage({
                            command: 'updateHost',
                            host: hostInput.value
                        });
                    });
                    
                    // 监听请求模式选择
                    requestModeRadios.forEach(radio => {
                        radio.addEventListener('change', () => {
                            if (radio.checked) {
                                vscode.postMessage({
                                    command: 'updateRequestMode',
                                    mode: radio.value
                                });
                            }
                        });
                    });
                    
                    // 监听执行按钮点击
                    executeBtn.addEventListener('click', () => {
                        // 显示加载指示器
                        loadingIndicator.style.display = 'block';
                        responseOutput.textContent = '';
                        
                        // 获取请求参数
                        let requestJson;
                        try {
                            requestJson = JSON.parse(requestInput.value);
                        } catch (e) {
                            responseOutput.textContent = 'JSON 解析错误: ' + e.message;
                            loadingIndicator.style.display = 'none';
                            return;
                        }
                        
                        // 发送请求消息到扩展
                        vscode.postMessage({
                            command: 'executeRequest',
                            request: requestJson
                        });
                    });
                    
                    // 处理来自扩展的消息
                    window.addEventListener('message', event => {
                        const message = event.data;
                        
                        if (message.type === 'response') {
                            // 更新响应区域内容
                            responseOutput.textContent = message.content;
                            // 隐藏加载指示器
                            loadingIndicator.style.display = 'none';
                        }
                    });
                })();
            </script>
        </body>
        </html>`;
    }
    
    // 执行 gRPC 或 HTTP 请求
    private async executeRequest(requestData: any) {
        if (!this.currentService || !this.currentMethod) {
            this.showResponse('错误: 未选择服务或方法');
            return;
        }
        
        try {
            let output: string;
            
            if (this.requestMode === 'grpc') {
                // 执行 gRPC 请求
                output = await this.executeGrpcRequest(requestData);
            } else {
                // 执行 HTTP 请求
                output = await this.executeHttpRequest(requestData);
            }
            
            // 显示响应
            this.showResponse(output);
        } catch (error: any) {
            this.showResponse(`执行请求时出错: ${error.message}`);
        }
    }
    
    // 执行 gRPC 请求
    private async executeGrpcRequest(requestData: any): Promise<string> {
        if (!this.currentService || !this.currentMethod) {
            throw new Error('未选择服务或方法');
        }

        try {
            // 获取参数
            const { serviceName, methodName } = this.getGrpcParams();
            const protoFilePath = this.currentService.filePath;
            
            // 创建导入路径数组
            const importPaths: string[] = [];
            
            // 工作区文件夹
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                throw new Error('未找到工作区文件夹');
            }
            
            // 添加 proto 文件所在目录
            importPaths.push(path.dirname(protoFilePath));
            
            // 添加 api 目录
            let apiDir = path.dirname(protoFilePath);
            while (path.basename(apiDir) !== 'api' && apiDir !== path.dirname(apiDir)) {
                apiDir = path.dirname(apiDir);
            }
            if (path.basename(apiDir) === 'api') {
                importPaths.push(path.dirname(apiDir));
            }
            
            // 添加工作区目录
            importPaths.push(workspaceFolder.uri.fsPath);
            
            // 添加常见的 proto 相关目录
            const thirdPartyPath = path.join(workspaceFolder.uri.fsPath, 'third_party');
            if (fs.existsSync(thirdPartyPath)) {
                importPaths.push(thirdPartyPath);
            }
            
            // 添加 GOPATH 中的相关目录
            const homedir = os.homedir();
            const gopath = process.env.GOPATH || path.join(homedir, 'go');
            importPaths.push(path.join(gopath, 'src'));
            
            // 加载 proto 文件
            console.log(`加载 proto 文件: ${protoFilePath}`);
            console.log(`导入路径: ${importPaths.join(', ')}`);
            
            const packageDefinition = protoLoader.loadSync(protoFilePath, {
                keepCase: true,
                longs: String,
                enums: String,
                defaults: true,
                oneofs: true,
                includeDirs: importPaths
            });
            
            // 获取服务定义
            const protoDescriptor = grpc.loadPackageDefinition(packageDefinition);
            
            // 从服务全名解析出包名和服务名
            const parts = serviceName.split('.');
            // 取出最后一个部分作为服务名
            const serviceShortName = parts.pop() || '';
            
            // 按路径逐级获取服务定义
            let packageObj: any = protoDescriptor;
            for (const part of parts) {
                if (!packageObj[part]) {
                    throw new Error(`找不到包: ${part} (${serviceName})`);
                }
                packageObj = packageObj[part];
            }
            
            const ServiceClass = packageObj[serviceShortName];
            if (!ServiceClass) {
                throw new Error(`找不到服务: ${serviceShortName} (${serviceName})`);
            }
            
            console.log(`创建 gRPC 客户端: ${this.currentHost}`);
            
            // 创建客户端
            const client = new ServiceClass(this.currentHost, grpc.credentials.createInsecure());
            
            if (!client[methodName]) {
                throw new Error(`找不到方法: ${methodName}`);
            }
            
            console.log(`调用方法: ${serviceName}.${methodName}`);
            console.log(`请求数据: ${JSON.stringify(requestData)}`);
            
            // 调用方法并返回 Promise
            return new Promise((resolve, reject) => {
                client[methodName](requestData, (err: Error | null, response: any) => {
                    if (err) {
                        console.error(`gRPC 请求错误: ${err.message}`);
                        reject(err);
                    } else {
                        console.log(`gRPC 请求成功`);
                        resolve(JSON.stringify(response, null, 2));
                    }
                });
            });
        } catch (error: any) {
            console.error(`执行 gRPC 请求失败: ${error.message}`);
            throw error;
        }
    }
    
    // 执行 HTTP 请求
    private async executeHttpRequest(requestData: any): Promise<string> {
        if (!this.currentMethod || !this.currentMethod.httpMethod || !this.currentMethod.httpPath) {
            throw new Error('当前方法没有定义 HTTP 选项');
        }
        
        try {
            const httpMethod = this.currentMethod.httpMethod.toLowerCase();
            let url = `http://${this.currentHost}${this.currentMethod.httpPath}`;
            const headers = { 'Content-Type': 'application/json' };
            
            let response;
            
            if (httpMethod === 'get') {
                // 对于 GET 请求，将参数作为查询参数
                response = await axios.get(url, { 
                    params: requestData,
                    headers
                });
            } else if (httpMethod === 'post') {
                // POST 请求
                response = await axios.post(url, requestData, { headers });
            } else if (httpMethod === 'put') {
                // PUT 请求
                response = await axios.put(url, requestData, { headers });
            } else if (httpMethod === 'delete') {
                // DELETE 请求
                response = await axios.delete(url, { 
                    data: requestData,
                    headers
                });
            } else if (httpMethod === 'patch') {
                // PATCH 请求
                response = await axios.patch(url, requestData, { headers });
            } else {
                throw new Error(`不支持的 HTTP 方法: ${httpMethod}`);
            }
            
            // 返回格式化的响应数据
            return JSON.stringify(response.data, null, 2);
        } catch (error: any) {
            if (error.response) {
                // 服务器返回了错误状态码
                return `HTTP 错误 ${error.response.status}: ${JSON.stringify(error.response.data, null, 2)}`;
            } else if (error.request) {
                // 请求已发送但没有收到响应
                return `请求错误: 无法连接到服务器`;
            } else {
                // 设置请求时发生错误
                throw error;
            }
        }
    }
    
    // 获取 gRPC 请求的参数
    private getGrpcParams() {
        const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
        if (!workspaceFolder) {
            throw new Error('未找到工作区文件夹');
        }
        
        if (!this.currentService || !this.currentMethod) {
            throw new Error('未选择服务或方法');
        }
        
        const protoFilePath = this.currentService.filePath;
        const serviceName = this.currentService.fullName;
        const methodName = this.currentMethod.name;
        
        // 获取导入路径
        const protoImportPaths = [];
        
        // 添加 proto 文件所在目录
        protoImportPaths.push(`-import-path=${path.dirname(protoFilePath)}`);
        
        // 添加 api 目录
        let apiDir = path.dirname(protoFilePath);
        while (path.basename(apiDir) !== 'api' && apiDir !== path.dirname(apiDir)) {
            apiDir = path.dirname(apiDir);
        }
        if (path.basename(apiDir) === 'api') {
            protoImportPaths.push(`-import-path=${path.dirname(apiDir)}`);
        }
        
        // 添加工作区目录
        protoImportPaths.push(`-import-path=${workspaceFolder.uri.fsPath}`);
        
        // 尝试添加 third_party 目录
        const thirdPartyPath = path.join(workspaceFolder.uri.fsPath, 'third_party');
        if (fs.existsSync(thirdPartyPath)) {
            protoImportPaths.push(`-import-path=${thirdPartyPath}`);
        }
        
        // 添加 GOPATH 中的相关目录
        const homedir = os.homedir();
        const gopath = process.env.GOPATH || path.join(homedir, 'go');
        protoImportPaths.push(`-import-path=${path.join(gopath, 'src')}`);
        
        // 特别添加 googleapis 目录
        const googleapisPath = path.join(workspaceFolder.uri.fsPath, 'third_party', 'googleapis');
        if (fs.existsSync(googleapisPath)) {
            protoImportPaths.push(`-import-path=${googleapisPath}`);
        }
        
        // 尝试添加 kratos third_party 目录
        const kratosThirdPartyPath = path.join(gopath, 'src', 'github.com', 'go-kratos', 'kratos', 'third_party');
        if (fs.existsSync(kratosThirdPartyPath)) {
            protoImportPaths.push(`-import-path=${kratosThirdPartyPath}`);
        }
        
        return { protoImportPaths, protoFilePath, serviceName, methodName };
    }
    
    // 显示响应结果
    private showResponse(content: string) {
        // 尝试格式化 JSON 响应
        try {
            const json = JSON.parse(content);
            content = JSON.stringify(json, null, 2);
        } catch (e) {
            // 不是有效的 JSON，保持原样
        }
        
        // 发送响应到 webview
        this.panel.webview.postMessage({
            type: 'response',
            content
        });
    }
    
    // 销毁面板
    public dispose() {
        GrpcClientPanel.currentPanel = undefined;
        
        // 清理资源
        this.panel.dispose();
        
        while (this.disposables.length) {
            const disposable = this.disposables.pop();
            if (disposable) {
                disposable.dispose();
            }
        }
    }
}

// 打开 gRPC 方法
export function openGrpcMethod(service: ServiceInfo, method: MethodInfo, context: vscode.ExtensionContext, services: ServiceInfo[]) {
    GrpcClientPanel.createOrShow(context.extensionUri, services, service, method);
} 