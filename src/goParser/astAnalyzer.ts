import * as vscode from 'vscode';
import { GoMethod, GoParam, GoInterface, GoStruct } from '../goTypes';

export class GoASTAnalyzer {
    
    /**
     * 解析Go文件内容，提取接口和结构体信息
     */
    public static async analyzeGoFile(document: vscode.TextDocument): Promise<{ interfaces: GoInterface[], structs: GoStruct[] }> {
        const content = document.getText();
        const interfaces = this.parseInterfaces(content, document);
        const structs = this.parseStructs(content, document);
        
        // 调试信息
        console.log(`[GoJump] 文件 ${document.fileName}: 找到 ${interfaces.length} 个接口, ${structs.length} 个结构体`);
        interfaces.forEach(intf => {
            console.log(`[GoJump] 接口 ${intf.name}: ${intf.methods.length} 个方法`);
        });
        
        return { interfaces, structs };
    }

    /**
     * 解析接口定义
     */
    private static parseInterfaces(content: string, document: vscode.TextDocument): GoInterface[] {
        const interfaces: GoInterface[] = [];
        
        // 改进的接口匹配正则表达式
        const interfacePattern = /type\s+(\w+)\s+interface\s*\{([^{}]*(?:\{[^{}]*\}[^{}]*)*)\}/gs;
        let match;
        
        while ((match = interfacePattern.exec(content)) !== null) {
            const interfaceName = match[1];
            const interfaceBody = match[2];
            const interfaceStart = match.index;
            const interfaceEnd = match.index + match[0].length;
            
            console.log(`[GoJump] 找到接口: ${interfaceName}`);
            console.log(`[GoJump] 接口体内容: ${interfaceBody}`);
            
            const startPos = document.positionAt(interfaceStart);
            const endPos = document.positionAt(interfaceEnd);
            
            // 解析接口体内的方法，传递正确的偏移量
            const bodyStart = content.indexOf('{', interfaceStart) + 1;
            const methods = this.parseMethodsFromInterfaceBody(interfaceBody, document, bodyStart);
            
            interfaces.push({
                name: interfaceName,
                methods: methods,
                position: startPos,
                range: new vscode.Range(startPos, endPos),
                filePath: document.uri.fsPath
            });
        }
        
        return interfaces;
    }

    /**
     * 解析结构体定义和其方法
     */
    private static parseStructs(content: string, document: vscode.TextDocument): GoStruct[] {
        const structs: GoStruct[] = [];
        
        // 匹配结构体定义的正则表达式
        const structRegex = /type\s+(\w+)\s+struct\s*\{[^}]*\}/gs;
        let match;
        
        while ((match = structRegex.exec(content)) !== null) {
            const structName = match[1];
            const startPos = document.positionAt(match.index);
            const endPos = document.positionAt(match.index + match[0].length);
            
            console.log(`[GoJump] 找到结构体: ${structName}`);
            
            // 查找该结构体的方法
            const methods = this.parseMethodsForStruct(structName, content, document);
            
            structs.push({
                name: structName,
                methods: methods,
                position: startPos,
                range: new vscode.Range(startPos, endPos),
                filePath: document.uri.fsPath
            });
        }
        
        return structs;
    }

    /**
     * 从接口体中解析方法
     */
    private static parseMethodsFromInterfaceBody(interfaceBody: string, document: vscode.TextDocument, baseOffset: number): GoMethod[] {
        const methods: GoMethod[] = [];
        
        // 改进的方法匹配正则表达式
        const lines = interfaceBody.split('\n');
        let currentOffset = baseOffset;
        
        for (const line of lines) {
            const trimmedLine = line.trim();
            if (!trimmedLine || trimmedLine.startsWith('//') || trimmedLine.startsWith('/*')) {
                currentOffset += line.length + 1; // +1 for newline
                continue;
            }
            
            // 匹配方法：方法名(参数) 返回值
            const methodMatch = trimmedLine.match(/^(\w+)\s*\(([^)]*)\)\s*(.*)$/);
            if (methodMatch) {
                const methodName = methodMatch[1];
                const paramsStr = methodMatch[2] || '';
                const returnsStr = methodMatch[3] || '';
                
                console.log(`[GoJump] 找到接口方法: ${methodName}`);
                
                const params = this.parseParameters(paramsStr);
                const returns = this.parseReturns(returnsStr);
                
                // 计算方法在文档中的位置
                const lineStartInBody = interfaceBody.indexOf(trimmedLine);
                const methodStartPos = document.positionAt(currentOffset + line.indexOf(methodName));
                const methodEndPos = document.positionAt(currentOffset + line.indexOf(methodName) + methodName.length);
                
                methods.push({
                    name: methodName,
                    signature: trimmedLine,
                    params: params,
                    returns: returns,
                    position: methodStartPos,
                    range: new vscode.Range(methodStartPos, methodEndPos)
                });
            }
            
            currentOffset += line.length + 1; // +1 for newline
        }
        
        return methods;
    }

    /**
     * 查找结构体的方法
     */
    private static parseMethodsForStruct(structName: string, content: string, document: vscode.TextDocument): GoMethod[] {
        const methods: GoMethod[] = [];
        
        // 匹配结构体方法的正则表达式 - 包括指针接收者和值接收者
        const methodRegex = new RegExp(`func\\s*\\(\\s*\\w*\\s*\\*?${structName}\\s*\\)\\s*(\\w+)\\s*\\(([^)]*)\\)\\s*(\\([^)]*\\)|[\\w\\[\\]\\*]*)?`, 'g');
        let match;
        
        while ((match = methodRegex.exec(content)) !== null) {
            const methodName = match[1];
            const paramsStr = match[2] || '';
            const returnsStr = match[3] || '';
            
            console.log(`[GoJump] 找到结构体方法: ${structName}.${methodName}`);
            
            const params = this.parseParameters(paramsStr);
            const returns = this.parseReturns(returnsStr);
            
            const methodPos = document.positionAt(match.index);
            const methodNameStart = match.index + match[0].indexOf(methodName);
            const methodStartPos = document.positionAt(methodNameStart);
            const methodEndPos = document.positionAt(methodNameStart + methodName.length);
            
            methods.push({
                name: methodName,
                signature: `${methodName}(${paramsStr}) ${returnsStr}`.trim(),
                params: params,
                returns: returns,
                position: methodStartPos,
                range: new vscode.Range(methodStartPos, methodEndPos)
            });
        }
        
        return methods;
    }

    /**
     * 解析方法参数
     */
    private static parseParameters(paramStr: string): GoParam[] {
        if (!paramStr.trim()) {
            return [];
        }
        
        const params: GoParam[] = [];
        const paramParts = paramStr.split(',');
        
        for (const part of paramParts) {
            const trimmed = part.trim();
            if (!trimmed) continue;
            
            const tokens = trimmed.split(/\s+/);
            if (tokens.length >= 2) {
                params.push({
                    name: tokens[0],
                    type: tokens.slice(1).join(' ')
                });
            } else if (tokens.length === 1) {
                // 只有类型，没有参数名
                params.push({
                    name: '',
                    type: tokens[0]
                });
            }
        }
        
        return params;
    }

    /**
     * 解析返回值
     */
    private static parseReturns(returnStr: string): GoParam[] {
        if (!returnStr.trim()) {
            return [];
        }
        
        // 移除外层括号
        const cleaned = returnStr.replace(/^\(|\)$/g, '').trim();
        if (!cleaned) {
            return [];
        }
        
        return this.parseParameters(cleaned);
    }

    /**
     * 比较两个方法是否匹配（用于接口和实现的匹配）
     */
    public static methodsMatch(interfaceMethod: GoMethod, structMethod: GoMethod): boolean {
        console.log(`[GoJump] 比较方法: ${interfaceMethod.name} vs ${structMethod.name}`);
        console.log(`[GoJump] 接口方法签名: ${interfaceMethod.signature}`);
        console.log(`[GoJump] 结构体方法签名: ${structMethod.signature}`);
        
        // 检查方法名
        if (interfaceMethod.name !== structMethod.name) {
            console.log(`[GoJump] 方法名不匹配: ${interfaceMethod.name} != ${structMethod.name}`);
            return false;
        }
        
        // 检查参数数量
        if (interfaceMethod.params.length !== structMethod.params.length) {
            console.log(`[GoJump] 参数数量不匹配: ${interfaceMethod.params.length} != ${structMethod.params.length}`);
            return false;
        }
        
        // 检查返回值数量
        if (interfaceMethod.returns.length !== structMethod.returns.length) {
            console.log(`[GoJump] 返回值数量不匹配: ${interfaceMethod.returns.length} != ${structMethod.returns.length}`);
            return false;
        }
        
        // 暂时简化类型检查，只做基本比较
        console.log(`[GoJump] 方法匹配成功: ${interfaceMethod.name}`);
        return true;
        
        // TODO: 以后可以启用更严格的类型检查
        /*
        // 检查参数类型
        for (let i = 0; i < interfaceMethod.params.length; i++) {
            if (interfaceMethod.params[i].type !== structMethod.params[i].type) {
                console.log(`[GoJump] 参数类型不匹配[${i}]: ${interfaceMethod.params[i].type} != ${structMethod.params[i].type}`);
                return false;
            }
        }
        
        // 检查返回值类型
        for (let i = 0; i < interfaceMethod.returns.length; i++) {
            if (interfaceMethod.returns[i].type !== structMethod.returns[i].type) {
                console.log(`[GoJump] 返回值类型不匹配[${i}]: ${interfaceMethod.returns[i].type} != ${structMethod.returns[i].type}`);
                return false;
            }
        }
        */
    }
} 