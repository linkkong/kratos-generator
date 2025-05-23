import { ServiceInfo, MethodInfo, UrlInfo } from './protoTypes';

/**
 * 生成完整的请求URL信息
 * @param service 服务信息
 * @param method 方法信息
 * @param host 主机地址（如：localhost:9000）
 * @returns URL信息对象
 */
export function generateUrlInfo(service: ServiceInfo, method: MethodInfo, host: string): UrlInfo {
    // 确保主机地址格式正确
    const cleanHost = host.replace(/^https?:\/\//, '').replace(/\/$/, '');
    
    // 生成gRPC URL
    const grpcUrl = generateGrpcUrl(service, method, cleanHost);
    
    // 生成HTTP URL（如果支持）
    const httpUrl = method.hasHttpOption && method.httpPath ? 
        generateHttpUrl(method, cleanHost) : undefined;
    
    // 生成描述信息
    const description = generateUrlDescription(service, method, grpcUrl, httpUrl);
    
    return {
        grpcUrl,
        httpUrl,
        description
    };
}

/**
 * 生成gRPC URL
 * @param service 服务信息
 * @param method 方法信息
 * @param host 主机地址
 * @returns gRPC URL字符串
 */
function generateGrpcUrl(service: ServiceInfo, method: MethodInfo, host: string): string {
    // gRPC URL格式：serviceName/methodName
    const servicePath = service.fullName || service.name;
    return `grpc://${host}/${servicePath}/${method.name}`;
}

/**
 * 生成HTTP URL
 * @param method 方法信息
 * @param host 主机地址
 * @returns HTTP URL字符串
 */
function generateHttpUrl(method: MethodInfo, host: string): string {
    if (!method.httpPath) {
        throw new Error('HTTP路径未定义');
    }
    
    // 确保路径以/开头
    const path = method.httpPath.startsWith('/') ? method.httpPath : `/${method.httpPath}`;
    
    // 根据路径中是否包含参数占位符来处理
    const processedPath = processHttpPath(path);
    
    return `http://${host}${processedPath}`;
}

/**
 * 处理HTTP路径中的参数占位符
 * @param path 原始路径
 * @returns 处理后的路径
 */
function processHttpPath(path: string): string {
    // 将gRPC HTTP API中的路径变量格式 {variable} 转换为示例值
    return path.replace(/\{([^}]+)\}/g, (match, varName) => {
        // 根据变量名生成示例值
        if (varName.toLowerCase().includes('id')) {
            return '123';
        } else if (varName.toLowerCase().includes('name')) {
            return 'example-name';
        } else if (varName.toLowerCase().includes('code')) {
            return 'ABC123';
        } else {
            return `{${varName}}`;
        }
    });
}

/**
 * 生成URL描述信息
 * @param service 服务信息
 * @param method 方法信息
 * @param grpcUrl gRPC URL
 * @param httpUrl HTTP URL（可选）
 * @returns 描述字符串
 */
function generateUrlDescription(
    service: ServiceInfo, 
    method: MethodInfo, 
    grpcUrl: string, 
    httpUrl?: string
): string {
    const lines = [];
    
    lines.push(`服务: ${service.name}`);
    lines.push(`方法: ${method.name}`);
    lines.push(`请求类型: ${method.requestType}`);
    lines.push(`响应类型: ${method.responseType}`);
    lines.push('');
    lines.push('支持的协议:');
    lines.push(`  • gRPC: ${grpcUrl}`);
    
    if (httpUrl && method.httpMethod) {
        lines.push(`  • HTTP: ${method.httpMethod.toUpperCase()} ${httpUrl}`);
        if (method.httpBody) {
            lines.push(`    Body参数: ${method.httpBody}`);
        }
    }
    
    return lines.join('\n');
}

/**
 * 验证主机地址格式
 * @param host 主机地址
 * @returns 是否有效
 */
export function validateHost(host: string): boolean {
    if (!host || host.trim() === '') {
        return false;
    }
    
    // 移除协议前缀进行验证
    const cleanHost = host.replace(/^https?:\/\//, '');
    
    // 基本格式验证：hostname:port 或 hostname
    const hostRegex = /^[a-zA-Z0-9.-]+(:[0-9]+)?$/;
    return hostRegex.test(cleanHost);
}

/**
 * 格式化主机地址
 * @param host 原始主机地址
 * @returns 格式化后的主机地址
 */
export function formatHost(host: string): string {
    if (!host) {
        return 'localhost:9000';
    }
    
    return host.replace(/^https?:\/\//, '').replace(/\/$/, '');
} 