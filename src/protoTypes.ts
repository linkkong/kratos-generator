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
}

// 定义消息信息接口
export interface MessageInfo {
    name: string;
    fields: FieldInfo[];
} 