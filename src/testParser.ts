import * as fs from 'fs';
import * as path from 'path';
import { MethodInfo, ServiceInfo } from './protoTypes';

/**
 * 从服务体中解析方法信息，复制自 protoMethodParser.ts
 */
function parseMethods(serviceName: string, serviceBody: string, content: string): MethodInfo[] {
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
 * 解析单个方法的信息，复制自 protoMethodParser.ts
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
 * 独立解析服务，不依赖 vscode
 */
function parseServicesFromContent(content: string, filePath: string): ServiceInfo[] {
    const services: ServiceInfo[] = [];
    const packageName = path.basename(path.dirname(filePath));
    
    // 提取包名
    let protoPackage = packageName;
    const packageMatch = content.match(/package\s+([a-zA-Z0-9_.]+)\s*;/);
    if (packageMatch) {
        protoPackage = packageMatch[1];
        console.log(`找到包名: ${protoPackage}`);
    }
    
    // 尝试提取服务定义
    console.log(`----- 开始提取服务定义 -----`);
    
    // 分析整个文件内容以更精确地提取服务块
    let serviceBlockStart = -1;
    let serviceName = '';
    const services_data: {name: string, start: number, end: number}[] = [];
    
    // 先定位所有service块的位置
    const serviceStartRegex = /service\s+(\w+)\s*{/g;
    let serviceStartMatch;
    while ((serviceStartMatch = serviceStartRegex.exec(content)) !== null) {
        serviceName = serviceStartMatch[1];
        serviceBlockStart = serviceStartMatch.index;
        
        // 找到匹配的右大括号
        let braceCount = 1;
        let i = serviceStartMatch.index + serviceStartMatch[0].length;
        
        while (braceCount > 0 && i < content.length) {
            if (content[i] === '{') {
                braceCount++;
            } else if (content[i] === '}') {
                braceCount--;
                if (braceCount === 0) {
                    // 找到匹配的右括号，添加服务信息
                    services_data.push({
                        name: serviceName,
                        start: serviceBlockStart,
                        end: i
                    });
                }
            }
            i++;
        }
    }
    
    // 遍历所有找到的服务块
    for (const service_data of services_data) {
        const serviceText = content.substring(service_data.start, service_data.end + 1);
        const serviceBodyMatch = serviceText.match(/service\s+\w+\s*{([\s\S]*)}/);
        
        if (serviceBodyMatch) {
            const serviceBody = serviceBodyMatch[1];
            console.log(`\n找到服务: ${service_data.name}`);
            console.log(`服务体长度: ${serviceBody.length} 字符`);
            console.log(`服务体前100字符:\n${serviceBody.substring(0, 100).replace(/\n/g, '\\n')}...`);
            
            // 解析服务中的方法
            const methods = parseMethods(service_data.name, serviceBody, content);
            
            if (methods.length > 0) {
                services.push({
                    name: service_data.name,
                    fullName: `${protoPackage}.${service_data.name}`,
                    filePath,
                    methods
                });
                console.log(`[${service_data.name}] 成功解析 ${methods.length} 个方法`);
            } else {
                console.log(`[${service_data.name}] ❌ 没有找到任何可用方法，跳过服务`);
            }
        }
    }
    
    return services;
}

/**
 * 测试解析器函数
 */
function testParser() {
    // 读取样本文件
    const filePath = path.join(__dirname, '..', 'samples', 'settlement.proto');
    const content = fs.readFileSync(filePath, 'utf8');
    
    console.log('========== 开始测试 Proto 解析 ==========');
    console.log(`加载测试文件: ${filePath}`);
    console.log(`文件大小: ${content.length} 字符`);
    console.log(`文件内容前200字符:\n${content.substring(0, 200).replace(/\n/g, '\\n')}...`);
    
    // 解析服务
    console.log('\n----- 开始解析服务 -----');
    const services = parseServicesFromContent(content, filePath);
    
    // 输出结果
    console.log(`\n找到 ${services.length} 个服务:`);
    for (const service of services) {
        console.log(`\n服务: ${service.name} (${service.fullName})`);
        console.log(`方法数量: ${service.methods.length}`);
        
        for (const method of service.methods) {
            const httpInfo = method.hasHttpOption ? 
                `[HTTP: ${method.httpMethod} ${method.httpPath}]` : '';
            console.log(`  - ${method.name}: ${method.requestType} -> ${method.responseType} ${httpInfo}`);
        }
    }
    
    console.log('\n========== 测试完成 ==========');
    return services;
}

// 执行测试
testParser(); 