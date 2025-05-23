// 定义服务信息接口
export interface ServiceInfo {
    name: string;
    fullName: string;
    filePath: string;
    methods: MethodInfo[];
}

// 定义方法信息接口
export interface MethodInfo {
    name: string;
    requestType: string;
    responseType: string;
    requestMessage?: MessageInfo;
    responseMessage?: MessageInfo;
    httpMethod?: string;      // 如 get, post, put, delete
    httpPath?: string;        // HTTP 路径
    httpBody?: string;        // HTTP body 参数
    hasHttpOption?: boolean;  // 是否定义了 HTTP 选项
}

// 定义消息字段信息接口
export interface FieldInfo {
    name: string;
    type: string;
    isMap: boolean;
    isRepeated: boolean;
    nestedFields?: FieldInfo[];
    isOptional?: boolean;
    defaultValue?: any;
    description?: string;
}

// 定义消息信息接口
export interface MessageInfo {
    name: string;
    fields: FieldInfo[];
}

// 定义完整的请求参数结构（用于显示所有key）
export interface RequestTemplate {
    structure: any;
    description: string;
}

// 定义URL信息接口
export interface UrlInfo {
    grpcUrl: string;
    httpUrl?: string;
    httpUrlTemplate?: string;  // HTTP URL模板（包含占位符）
    httpPathParams?: string[]; // HTTP路径参数列表
    description: string;
} 