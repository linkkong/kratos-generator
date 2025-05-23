import * as fs from 'fs';
import * as path from 'path';
import * as protobuf from 'protobufjs';
import * as os from 'os';
import * as vscode from 'vscode';
import { ServiceInfo, MessageInfo } from './protoTypes';
import { parseMethods } from './protoMethodParser';

/**
 * 处理消息字段
 * @param field protobuf 字段
 * @returns 处理后的字段信息
 */
function processField(field: any): any {
    let isMap = false;
    let isRepeated = false;
    let fieldType = field.type;

    if (field.repeated) {
        isRepeated = true;
    }

    if (field.map) {
        isMap = true;
    }

    return {
        name: field.name,
        type: fieldType,
        isMap,
        isRepeated
    };
}

/**
 * 递归处理消息
 * @param message protobuf 消息
 * @returns 处理后的消息信息
 */
function processMessage(message: any): MessageInfo {
    const fields: any[] = [];

    if (message.fields) {
        for (const fieldName in message.fields) {
            const field = message.fields[fieldName];
            fields.push(processField(field));
        }
    }

    return {
        name: message.name,
        fields
    };
}

/**
 * 获取可能的导入路径
 * @returns 可能的导入路径列表
 */
export async function getPossibleImportPaths(): Promise<string[]> {
    const workspaceFolders = vscode.workspace.workspaceFolders;
    if (!workspaceFolders) {
        console.log('未找到工作区文件夹');
        return [];
    }

    const importPaths: string[] = [];

    // 添加工作区根目录
    for (const folder of workspaceFolders) {
        importPaths.push(folder.uri.fsPath);
        
        // 添加常见的proto目录
        importPaths.push(path.join(folder.uri.fsPath, 'api'));
        importPaths.push(path.join(folder.uri.fsPath, 'third_party'));
        
        // 尝试添加GOPATH相关目录
        const gopath = process.env.GOPATH || path.join(os.homedir(), 'go');
        importPaths.push(path.join(gopath, 'src'));
        importPaths.push(path.join(gopath, 'pkg', 'mod'));
        
        // kratos通常使用的依赖目录
        importPaths.push(path.join(folder.uri.fsPath, 'third_party', 'googleapis'));
        importPaths.push(path.join(gopath, 'src', 'github.com', 'go-kratos', 'kratos', 'third_party'));
    }
    
    return importPaths;
}

/**
 * 从正则表达式解析服务
 * @param content 文件内容
 * @param filePath 文件路径
 * @returns 解析出的服务列表
 */
export function parseServicesFromRegex(content: string, filePath: string): ServiceInfo[] {
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
 * 使用宽松的正则表达式尝试解析服务
 * @param content 文件内容
 * @param filePath 文件路径
 * @returns 解析出的服务列表
 */
export function parseServicesFromLooseRegex(content: string, filePath: string): ServiceInfo[] {
    const services: ServiceInfo[] = [];
    const packageName = path.basename(path.dirname(filePath));
    
    // 提取包名
    let protoPackage = packageName;
    const packageMatch = content.match(/package\s+([a-zA-Z0-9_.]+)\s*;/);
    if (packageMatch) {
        protoPackage = packageMatch[1];
    }
    
    // 尝试提取服务定义
    console.log(`----- 使用宽松正则表达式解析服务 -----`);
    
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
            console.log(`[${service_data.name}] 发现服务体: ${serviceBody.length} 字符`);
            
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
 * 从 protobufjs 对象解析服务
 * @param root protobufjs Root 对象
 * @param filePath 文件路径
 * @param content 文件内容
 * @returns 解析出的服务列表
 */
export function parseServicesFromProtobufjs(root: protobuf.Root, filePath: string, content: string): ServiceInfo[] {
    const services: ServiceInfo[] = [];
    
    // 遍历所有命名空间
    for (const namespace of root.nestedArray) {
        // 检查命名空间是否有嵌套对象
        const namespaceWithNested = namespace as any;
        if (namespaceWithNested.nested) {
            for (const name in namespaceWithNested.nested) {
                const obj = namespaceWithNested.nested[name];
                
                if (obj.className === 'Service') {
                    console.log(`[protobufjs] 找到服务: ${name}`);
                    const service = obj as protobuf.Service;
                    
                    // 使用正则表达式提取服务体
                    const serviceRegex = new RegExp(`service\\s+${name}\\s*{([^}]*)}`, 'gs');
                    const serviceMatch = serviceRegex.exec(content);
                    
                    let methods = [];
                    if (serviceMatch && serviceMatch[1]) {
                        // 如果能从内容中找到服务定义，使用我们的解析器解析方法
                        methods = parseMethods(name, serviceMatch[1], content);
                    } else {
                        // 否则使用 protobufjs 的方法
                        console.log(`[protobufjs] 无法从内容中找到服务 ${name} 的定义，使用 protobufjs 解析方法`);
                        methods = [];
                        
                        for (const methodName in service.methods) {
                            console.log(`[protobufjs] 方法: ${methodName}`);
                            const method = service.methods[methodName];
                            const requestType = method.requestType;
                            const responseType = method.responseType;
                            
                            // 获取请求和响应消息
                            let requestMessage: MessageInfo | undefined;
                            let responseMessage: MessageInfo | undefined;
                            
                            try {
                                const reqType = root.lookupType(requestType);
                                requestMessage = processMessage(reqType);
                                
                                const resType = root.lookupType(responseType);
                                responseMessage = processMessage(resType);
                            } catch (error) {
                                console.error(`[protobufjs] 处理消息类型时出错: ${error}`);
                            }
                            
                            // 尝试从文件内容中找到方法定义，提取HTTP信息
                            const methodRegex = new RegExp(`rpc\\s+${methodName}\\s*\\([^\\)]*\\)\\s*returns\\s*\\([^\\)]*\\)[^;]*`, 'i');
                            const methodMatch = content.match(methodRegex);
                            
                            let httpMethod: string | undefined;
                            let httpPath: string | undefined;
                            let httpBody: string | undefined;
                            let hasHttpOption = false;
                            
                            if (methodMatch && methodMatch[0]) {
                                const methodText = methodMatch[0];
                                // 检查是否有 HTTP 选项
                                hasHttpOption = methodText.includes('(google.api.http)');
                                
                                if (hasHttpOption) {
                                    console.log(`[protobufjs] [${name}.${methodName}] 检测到 HTTP 选项`);
                                    
                                    // 提取 HTTP 方法和路径
                                    const httpMethodMatch = methodText.match(/(get|post|put|delete|patch):\s*"([^"]+)"/i);
                                    if (httpMethodMatch) {
                                        httpMethod = httpMethodMatch[1].toLowerCase();
                                        httpPath = httpMethodMatch[2];
                                        console.log(`[protobufjs] [${name}.${methodName}] HTTP 方法: ${httpMethod}, 路径: ${httpPath}`);
                                        
                                        // 提取 HTTP body 配置
                                        const bodyMatch = methodText.match(/body:\s*"([^"]+)"/);
                                        if (bodyMatch) {
                                            httpBody = bodyMatch[1];
                                            console.log(`[protobufjs] [${name}.${methodName}] HTTP body: ${httpBody}`);
                                        } else if (httpMethod === 'post' || httpMethod === 'put' || httpMethod === 'patch') {
                                            // 对于这些方法，如果没有指定 body，默认使用 "*"
                                            httpBody = "*";
                                        }
                                    }
                                }
                            }
                            
                            methods.push({
                                name: methodName,
                                requestType,
                                responseType,
                                requestMessage,
                                responseMessage,
                                httpMethod,
                                httpPath,
                                httpBody,
                                hasHttpOption
                            });
                        }
                    }
                    
                    if (methods.length > 0) {
                        services.push({
                            name: service.name,
                            fullName: `${namespaceWithNested.name}.${service.name}`,
                            filePath,
                            methods
                        });
                    }
                }
            }
        }
    }
    
    return services;
}

/**
 * 过滤服务，排除不需要的服务
 * @param services 服务列表
 * @returns 过滤后的服务列表
 */
export function filterServices(services: ServiceInfo[]): ServiceInfo[] {
    // 需要过滤的服务名称
    const excludedServices = [
        'HTTP',
        'Health',
        'Reflection',
        'ServerReflection',
        'XDS',
    ];

    // 需要过滤的文件名模式
    const excludedFilePatterns = [
        'google/api/http.proto',
        'google/api/annotations.proto',
        'google/api/httpbody.proto',
        'google/protobuf/',
        'google/rpc/',
        'validate/',
        'errors/',
        'common/',
        'health/',
        'status.proto',
        'reflection.proto',
    ];

    // 需要过滤的包名前缀
    const excludedPackagePrefixes = [
        'google.',
        'grpc.',
        'envoy.',
        'validate.',
        'errors.',
        'http.',
    ];

    console.log('应用过滤规则:');
    console.log(`- 排除的服务名: ${excludedServices.join(', ')}`);
    console.log(`- 排除的文件模式: ${excludedFilePatterns.join(', ')}`);
    console.log(`- 排除的包名前缀: ${excludedPackagePrefixes.join(', ')}`);

    // 按条件过滤
    const filteredServices = services.filter(service => {
        // 过滤排除的服务名
        if (excludedServices.includes(service.name)) {
            console.log(`[过滤] 服务: ${service.name} (匹配排除的服务名)`);
            return false;
        }
        
        // 过滤特定文件模式
        for (const pattern of excludedFilePatterns) {
            if (service.filePath.toLowerCase().includes(pattern.toLowerCase())) {
                console.log(`[过滤] 服务: ${service.name} (匹配排除的文件模式: ${pattern})`);
                return false;
            }
        }
        
        // 过滤特定包名前缀
        for (const prefix of excludedPackagePrefixes) {
            if (service.fullName.toLowerCase().startsWith(prefix.toLowerCase())) {
                console.log(`[过滤] 服务: ${service.name} (匹配排除的包名前缀: ${prefix})`);
                return false;
            }
        }
        
        // 过滤没有方法的服务
        if (service.methods.length === 0) {
            console.log(`[过滤] 服务: ${service.name} (没有方法)`);
            return false;
        }
        
        return true;
    });

    // 按文件路径和名称排序
    filteredServices.sort((a, b) => {
        // 先按文件路径排序
        const pathCompare = a.filePath.localeCompare(b.filePath);
        if (pathCompare !== 0) {
            return pathCompare;
        }
        // 再按服务名排序
        return a.name.localeCompare(b.name);
    });

    console.log(`过滤后保留服务:`);
    filteredServices.forEach(service => {
        console.log(`- ${service.name} (${service.methods.length} 个方法)`);
    });

    return filteredServices;
} 