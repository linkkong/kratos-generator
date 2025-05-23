import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as protobuf from 'protobufjs';
import { ServiceInfo, MethodInfo } from './protoTypes';
import { parseMethods, generateRequestExample } from './protoMethodParser';
import { 
    getPossibleImportPaths, 
    parseServicesFromRegex, 
    parseServicesFromLooseRegex, 
    parseServicesFromProtobufjs,
    filterServices 
} from './protoServiceParser';

// 重新导出生成 JSON 示例的函数，保持向后兼容
export { generateRequestExample };

/**
 * 扫描工作区中的 proto 文件
 * @returns Promise<string[]> proto 文件路径列表
 */
export async function scanProtoFiles(): Promise<string[]> {
    console.log('开始扫描 proto 文件...');
    const apiFiles = await vscode.workspace.findFiles('**/api/**/*.proto', '**/vendor/**');
    console.log(`找到 ${apiFiles.length} 个 proto 文件`);
    return apiFiles.map(file => file.fsPath);
}

/**
 * 解析 proto 文件并提取服务信息
 * @param filePath proto 文件路径
 * @returns Promise<ServiceInfo[]> 服务信息列表
 */
export async function parseProtoFile(filePath: string): Promise<ServiceInfo[]> {
    console.log(`========== 开始解析 proto 文件: ${filePath} ==========`);
    try {
        const root = new protobuf.Root();
        
        // 获取可能的导入路径
        const importPaths = await getPossibleImportPaths();
        
        // 添加文件所在目录到导入路径
        const fileDir = path.dirname(filePath);
        importPaths.unshift(fileDir);
        
        // 设置导入解析器
        root.resolvePath = (origin, target) => {
            // 如果是相对路径，先尝试相对原文件的目录解析
            if (target.startsWith('.')) {
                const originDir = path.dirname(origin);
                const resolvedPath = path.resolve(originDir, target);
                if (fs.existsSync(resolvedPath)) {
                    return resolvedPath;
                }
            }
            
            // 尝试所有可能的导入路径
            for (const importPath of importPaths) {
                const resolvedPath = path.resolve(importPath, target);
                if (fs.existsSync(resolvedPath)) {
                    return resolvedPath;
                }
            }
            
            // 如果找不到，返回原始目标路径（protobufjs会尝试加载）
            return target;
        };
        
        // 加载proto文件
        await root.load(filePath, { keepCase: true, alternateCommentMode: true });

        // 读取文件内容
        const content = fs.readFileSync(filePath, 'utf8');
        console.log(`----- 开始解析文件内容 -----`);
        
        // 尝试使用正则表达式解析
        const regexServices = parseServicesFromRegex(content, filePath);
        if (regexServices.length > 0) {
            console.log(`----- 通过正则表达式找到 ${regexServices.length} 个服务 -----`);
            return regexServices;
        }
        
        // 如果正则表达式解析失败，尝试宽松正则
        console.log(`----- 未通过正则表达式找到服务定义，尝试宽松匹配 -----`);
        const looseRegexServices = parseServicesFromLooseRegex(content, filePath);
        if (looseRegexServices.length > 0) {
            console.log(`----- 通过宽松正则表达式找到 ${looseRegexServices.length} 个服务 -----`);
            return looseRegexServices;
        }
        
        // 最后尝试使用 protobufjs 解析
        console.log(`----- 尝试使用 protobufjs 解析 -----`);
        const protobufServices = parseServicesFromProtobufjs(root, filePath, content);
        console.log(`----- 通过 protobufjs 找到 ${protobufServices.length} 个服务 -----`);
        
        return protobufServices;
    } catch (error) {
        console.error(`解析 proto 文件 ${filePath} 时出错: ${error}`);
        return [];
    }
}

/**
 * 扫描和解析所有 proto 文件
 * @returns Promise<ServiceInfo[]> 所有服务信息的列表
 */
export async function scanAndParseProtoFiles(): Promise<ServiceInfo[]> {
    console.log('\n==================== 开始扫描和解析所有 proto 文件 ====================');
    try {
        const protoFiles = await scanProtoFiles();
        let allServices: ServiceInfo[] = [];

        console.log(`\n总共扫描到 ${protoFiles.length} 个 proto 文件，开始逐个解析...\n`);
        for (const filePath of protoFiles) {
            console.log(`\n----- 解析文件: ${path.basename(filePath)} -----`);
            const services = await parseProtoFile(filePath);
            const methodCount = services.reduce((sum, service) => sum + service.methods.length, 0);
            console.log(`文件 ${path.basename(filePath)} 解析结果: ${services.length} 个服务，${methodCount} 个方法`);
            
            // 输出服务和方法概览
            if (services.length > 0) {
                console.log('服务概览:');
                services.forEach(service => {
                    console.log(`  - ${service.name} (${service.methods.length} 个方法)`);
                    service.methods.forEach(method => {
                        const httpInfo = method.hasHttpOption ? 
                            `[HTTP: ${method.httpMethod} ${method.httpPath}]` : '';
                        console.log(`    * ${method.name} ${httpInfo}`);
                    });
                });
            }
            
            allServices.push(...services);
        }

        console.log(`\n==================== 解析完成 ====================`);
        console.log(`总结: 解析出 ${allServices.length} 个服务`);
        
        // 过滤服务
        console.log(`\n开始过滤服务...`);
        const originalCount = allServices.length;
        allServices = filterServices(allServices);
        console.log(`过滤结果: ${originalCount} 个服务 -> ${allServices.length} 个服务 (排除了 ${originalCount - allServices.length} 个)`);
        
        return allServices;
    } catch (error) {
        console.error(`扫描和解析 proto 文件时出错: ${error}`);
        return [];
    }
}