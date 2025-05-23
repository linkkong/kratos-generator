import * as vscode from 'vscode';
import * as fs from 'fs';
import * as path from 'path';
import * as protobuf from 'protobufjs';
import { MethodInfo, RequestTemplate, FieldInfo, MessageInfo } from './protoTypes';

/**
 * 生成完整的请求参数模板
 * @param method 方法信息
 * @param protoFilePath proto文件路径
 * @returns 请求参数模板
 */
export async function generateRequestTemplate(method: MethodInfo, protoFilePath: string): Promise<RequestTemplate> {
    try {
        // 解析proto文件获取完整的消息定义
        const messageInfo = await parseMessageStructure(method.requestType, protoFilePath);
        
        if (!messageInfo) {
            return {
                structure: {},
                description: `无法解析请求类型: ${method.requestType}`
            };
        }
        
        // 生成完整的参数结构
        const structure = generateStructureFromMessage(messageInfo);
        
        // 生成描述信息
        const description = generateTemplateDescription(method, messageInfo);
        
        return {
            structure,
            description
        };
    } catch (error) {
        console.error('生成请求模板失败:', error);
        return {
            structure: {},
            description: `生成请求模板失败: ${error}`
        };
    }
}

/**
 * 解析消息结构
 * @param messageType 消息类型名称
 * @param protoFilePath proto文件路径
 * @returns 消息信息
 */
async function parseMessageStructure(messageType: string, protoFilePath: string): Promise<MessageInfo | null> {
    try {
        const root = new protobuf.Root();
        
        // 获取导入路径
        const importPaths = await getImportPaths(protoFilePath);
        
        // 设置导入解析器
        root.resolvePath = (origin, target) => {
            if (target.startsWith('.')) {
                const originDir = path.dirname(origin);
                const resolvedPath = path.resolve(originDir, target);
                if (fs.existsSync(resolvedPath)) {
                    return resolvedPath;
                }
            }
            
            for (const importPath of importPaths) {
                const resolvedPath = path.resolve(importPath, target);
                if (fs.existsSync(resolvedPath)) {
                    return resolvedPath;
                }
            }
            
            return target;
        };
        
        // 加载proto文件
        await root.load(protoFilePath, { keepCase: true, alternateCommentMode: true });
        
        // 查找消息类型
        const messageProto = root.lookupType(messageType);
        if (!messageProto) {
            console.warn(`找不到消息类型: ${messageType}`);
            return null;
        }
        
        // 解析字段
        const fields = parseFields(messageProto, root);
        
        return {
            name: messageType,
            fields
        };
    } catch (error) {
        console.error(`解析消息结构失败: ${messageType}`, error);
        return null;
    }
}

/**
 * 解析字段信息
 * @param messageProto protobuf消息类型
 * @param root protobuf根对象
 * @returns 字段信息数组
 */
function parseFields(messageProto: protobuf.Type, root: protobuf.Root): FieldInfo[] {
    const fields: FieldInfo[] = [];
    
    for (const [fieldName, field] of Object.entries(messageProto.fields)) {
        const fieldInfo: FieldInfo = {
            name: fieldName,
            type: field.type,
            isMap: field instanceof protobuf.MapField,
            isRepeated: field.repeated || false,
            isOptional: field.optional || false,
            description: field.comment || undefined
        };
        
        // 如果是自定义类型，尝试解析嵌套字段
        if (field.resolvedType && field.resolvedType instanceof protobuf.Type) {
            fieldInfo.nestedFields = parseFields(field.resolvedType, root);
        }
        
        fields.push(fieldInfo);
    }
    
    return fields;
}

/**
 * 从消息信息生成结构
 * @param messageInfo 消息信息
 * @returns 生成的结构对象
 */
function generateStructureFromMessage(messageInfo: MessageInfo): any {
    const result: any = {};
    
    for (const field of messageInfo.fields) {
        if (field.isMap) {
            result[field.name] = generateMapStructure(field);
        } else if (field.isRepeated) {
            result[field.name] = [generateFieldValue(field)];
        } else {
            result[field.name] = generateFieldValue(field);
        }
    }
    
    return result;
}

/**
 * 生成Map类型的结构
 * @param field 字段信息
 * @returns Map结构
 */
function generateMapStructure(field: FieldInfo): any {
    const mapValue = generateFieldValue(field);
    return {
        "key_example": mapValue
    };
}

/**
 * 生成字段值
 * @param field 字段信息
 * @returns 字段值
 */
function generateFieldValue(field: FieldInfo): any {
    // 如果有嵌套字段，递归生成
    if (field.nestedFields && field.nestedFields.length > 0) {
        const nestedResult: any = {};
        for (const nestedField of field.nestedFields) {
            if (nestedField.isMap) {
                nestedResult[nestedField.name] = generateMapStructure(nestedField);
            } else if (nestedField.isRepeated) {
                nestedResult[nestedField.name] = [generateFieldValue(nestedField)];
            } else {
                nestedResult[nestedField.name] = generateFieldValue(nestedField);
            }
        }
        return nestedResult;
    }
    
    // 根据类型生成默认值
    return generateDefaultValueByType(field.type);
}

/**
 * 根据类型生成默认值
 * @param type 字段类型
 * @returns 默认值
 */
function generateDefaultValueByType(type: string): any {
    switch (type.toLowerCase()) {
        case 'string':
            return "";
        case 'int32':
        case 'int64':
        case 'uint32':
        case 'uint64':
        case 'sint32':
        case 'sint64':
        case 'fixed32':
        case 'fixed64':
        case 'sfixed32':
        case 'sfixed64':
        case 'double':
        case 'float':
            return 0;
        case 'bool':
            return false;
        case 'bytes':
            return "";
        default:
            // 对于未知类型或自定义类型，返回null
            return null;
    }
}

/**
 * 生成模板描述信息
 * @param method 方法信息
 * @param messageInfo 消息信息
 * @returns 描述字符串
 */
function generateTemplateDescription(method: MethodInfo, messageInfo: MessageInfo): string {
    const lines = [];
    
    lines.push(`请求参数模板 - ${method.name}`);
    lines.push(`类型: ${method.requestType}`);
    lines.push(`字段数量: ${messageInfo.fields.length}`);
    lines.push('');
    lines.push('字段说明:');
    
    for (const field of messageInfo.fields) {
        const typeInfo = field.isRepeated ? `${field.type}[]` : field.type;
        const optional = field.isOptional ? ' (可选)' : '';
        const map = field.isMap ? ' (映射)' : '';
        
        lines.push(`  • ${field.name}: ${typeInfo}${optional}${map}`);
        
        if (field.description) {
            lines.push(`    ${field.description}`);
        }
        
        // 如果有嵌套字段，显示嵌套结构
        if (field.nestedFields && field.nestedFields.length > 0) {
            for (const nestedField of field.nestedFields) {
                const nestedTypeInfo = nestedField.isRepeated ? `${nestedField.type}[]` : nestedField.type;
                const nestedOptional = nestedField.isOptional ? ' (可选)' : '';
                lines.push(`    ├─ ${nestedField.name}: ${nestedTypeInfo}${nestedOptional}`);
            }
        }
    }
    
    lines.push('');
    lines.push('注意: 上述结构中的值均为示例，请根据实际需要修改。');
    
    return lines.join('\n');
}

/**
 * 获取导入路径
 * @param protoFilePath proto文件路径
 * @returns 导入路径数组
 */
async function getImportPaths(protoFilePath: string): Promise<string[]> {
    const importPaths: string[] = [];
    
    // 添加文件所在目录
    importPaths.push(path.dirname(protoFilePath));
    
    // 获取工作区文件夹
    const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
    if (workspaceFolder) {
        importPaths.push(workspaceFolder.uri.fsPath);
        
        // 添加api目录
        let apiDir = path.dirname(protoFilePath);
        while (path.basename(apiDir) !== 'api' && apiDir !== path.dirname(apiDir)) {
            apiDir = path.dirname(apiDir);
        }
        if (path.basename(apiDir) === 'api') {
            importPaths.push(path.dirname(apiDir));
        }
        
        // 添加third_party目录
        const thirdPartyPath = path.join(workspaceFolder.uri.fsPath, 'third_party');
        if (fs.existsSync(thirdPartyPath)) {
            importPaths.push(thirdPartyPath);
        }
    }
    
    // 添加GOPATH
    const homedir = require('os').homedir();
    const gopath = process.env.GOPATH || path.join(homedir, 'go');
    importPaths.push(path.join(gopath, 'src'));
    
    return importPaths;
}

/**
 * 格式化请求模板为JSON字符串
 * @param template 请求模板
 * @returns 格式化的JSON字符串
 */
export function formatRequestTemplate(template: RequestTemplate): string {
    return JSON.stringify(template.structure, null, 2);
} 