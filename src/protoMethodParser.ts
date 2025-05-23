import * as fs from 'fs';
import { MethodInfo, MessageInfo } from './protoTypes';

/**
 * 从服务体中解析方法信息
 * @param serviceName 服务名称
 * @param serviceBody 服务定义内容
 * @param content 完整文件内容（用于protobuf.js不支持获取的信息）
 * @returns 解析出的方法列表
 */
export function parseMethods(serviceName: string, serviceBody: string, content: string): MethodInfo[] {
    const methods: MethodInfo[] = [];
    
    // 用宽松的正则表达式找出所有方法名称的位置
    const methodNameRegex = /rpc\s+(\w+)/g;
    let methodMatch;
    
    // 跟踪方法的起始位置
    const methodPositions = [];
    
    // 1. 先收集所有方法名称和位置
    console.log(`[${serviceName}] 开始解析方法，服务体长度: ${serviceBody.length} 字符`);
    while ((methodMatch = methodNameRegex.exec(serviceBody)) !== null) {
        const methodName = methodMatch[1];
        const startPos = methodMatch.index;
        console.log(`[${serviceName}] 找到方法 '${methodName}' 位置: ${startPos}`);
        methodPositions.push({
            name: methodName,
            startPos
        });
    }
    console.log(`[${serviceName}] 总共找到 ${methodPositions.length} 个方法`);
    
    // 2. 根据收集到的位置计算每个方法的区域
    for (let i = 0; i < methodPositions.length; i++) {
        const current = methodPositions[i];
        const methodName = current.name;
        const startPos = current.startPos;
        
        // 确定结束位置 - 可能是下一个方法的起始位置或服务体结束
        let endPos;
        if (i < methodPositions.length - 1) {
            // 如果有下一个方法，结束位置是下一个方法的起始位置
            endPos = methodPositions[i + 1].startPos;
            console.log(`[${serviceName}.${methodName}] 结束位置由下一个方法 '${methodPositions[i + 1].name}' 确定: ${endPos}`);
        } else {
            // 如果是最后一个方法，结束位置是服务体的结束
            endPos = serviceBody.length;
            console.log(`[${serviceName}.${methodName}] 作为最后一个方法，结束位置为服务体末尾: ${endPos}`);
        }
        
        // 提取方法体文本
        const methodText = serviceBody.substring(startPos, endPos).trim();
        console.log(`[${serviceName}.${methodName}] 提取的方法文本长度: ${methodText.length} 字符`);
        console.log(`[${serviceName}.${methodName}] 方法文本前50字符: ${methodText.substring(0, 50).replace(/\n/g, '\\n')}...`);
        
        // 解析方法信息
        const methodInfo = parseMethodInfo(serviceName, methodName, methodText);
        if (methodInfo) {
            methods.push(methodInfo);
            console.log(`[${serviceName}.${methodName}] ✅ 成功解析方法`);
        }
    }
    
    return methods;
}

/**
 * 解析单个方法的信息
 * @param serviceName 服务名称
 * @param methodName 方法名称
 * @param methodText 方法文本
 * @returns 方法信息，如果解析失败则返回 undefined
 */
function parseMethodInfo(serviceName: string, methodName: string, methodText: string): MethodInfo | undefined {
    // 检查是否有 HTTP 选项
    const hasHttpOption = methodText.includes('(google.api.http)');
    let httpMethod: string | undefined;
    let httpPath: string | undefined;
    let httpBody: string | undefined;

    if (hasHttpOption) {
        console.log(`[${serviceName}.${methodName}] 检测到 HTTP 选项`);
        
        // 提取 HTTP 方法和路径
        const httpMethodMatch = methodText.match(/(get|post|put|delete|patch):\s*"([^"]+)"/i);
        if (httpMethodMatch) {
            httpMethod = httpMethodMatch[1].toLowerCase();
            httpPath = httpMethodMatch[2];
            console.log(`[${serviceName}.${methodName}] HTTP 方法: ${httpMethod}, 路径: ${httpPath}`);
            
            // 提取 HTTP body 配置
            const bodyMatch = methodText.match(/body:\s*"([^"]+)"/);
            if (bodyMatch) {
                httpBody = bodyMatch[1];
                console.log(`[${serviceName}.${methodName}] HTTP body: ${httpBody}`);
            } else if (httpMethod === 'post' || httpMethod === 'put' || httpMethod === 'patch') {
                // 对于这些方法，如果没有指定 body，默认使用 "*"
                httpBody = "*";
            }
        }
    }
    
    // 提取请求类型
    let requestType: string | undefined;
    const reqMatch = methodText.match(/\(\s*([.\w]+)\s*\)/);
    if (reqMatch) {
        requestType = reqMatch[1];
        console.log(`[${serviceName}.${methodName}] 请求类型: ${requestType}`);
    } else {
        console.log(`[${serviceName}.${methodName}] ❌ 未找到标准请求类型`);
    }
    
    // 提取响应类型
    let responseType: string | undefined;
    const resMatch = methodText.match(/returns\s*\(\s*([.\w]+)\s*\)/);
    if (resMatch) {
        responseType = resMatch[1];
        console.log(`[${serviceName}.${methodName}] 响应类型: ${responseType}`);
    } else {
        console.log(`[${serviceName}.${methodName}] ❌ 未找到标准响应类型`);
    }
    
    // 如果找到了请求类型和响应类型，创建方法信息
    if (requestType && responseType) {
        return {
            name: methodName,
            requestType,
            responseType,
            httpMethod,
            httpPath,
            httpBody,
            hasHttpOption: !!hasHttpOption
        };
    } else {
        console.log(`[${serviceName}.${methodName}] 尝试使用宽松匹配...`);
        // 尝试更宽松的正则表达式
        const looseReqMatch = methodText.match(/\(([^)]+)\)/);
        const looseResMatch = methodText.match(/returns\s*\(([^)]+)\)/);
        
        if (looseReqMatch && looseResMatch) {
            const looseReqType = looseReqMatch[1].trim();
            const looseResType = looseResMatch[1].trim();
            console.log(`[${serviceName}.${methodName}] 宽松匹配成功: 请求=${looseReqType}, 响应=${looseResType}`);
            
            return {
                name: methodName,
                requestType: looseReqType,
                responseType: looseResType,
                httpMethod,
                httpPath,
                httpBody,
                hasHttpOption: !!hasHttpOption
            };
        } else {
            console.log(`[${serviceName}.${methodName}] ❌ 无法解析请求或响应类型，跳过此方法`);
            return undefined;
        }
    }
}

/**
 * 根据方法请求类型生成示例 JSON
 * @param method 方法信息
 * @returns JSON 示例字符串
 */
export function generateRequestExample(method: MethodInfo): string {
    if (!method.requestMessage) {
        return '{}';
    }

    const result: any = {};

    for (const field of method.requestMessage.fields) {
        if (field.isMap) {
            result[field.name] = {};
        } else if (field.isRepeated) {
            result[field.name] = [];
        } else if (field.type === 'string') {
            result[field.name] = '';
        } else if (field.type === 'number' || field.type === 'int32' || field.type === 'int64') {
            result[field.name] = 0;
        } else if (field.type === 'bool') {
            result[field.name] = false;
        } else {
            result[field.name] = null;
        }
    }

    return JSON.stringify(result, null, 2);
} 