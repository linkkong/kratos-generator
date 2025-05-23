import * as vscode from 'vscode';
import * as path from 'path';
import { scanAndParseProtoFiles } from './protoParser';
import { ServiceInfo, MethodInfo } from './protoTypes';

// 服务树视图项
class ServiceTreeItem extends vscode.TreeItem {
    constructor(
        public readonly service: ServiceInfo,
        public readonly collapsibleState: vscode.TreeItemCollapsibleState
    ) {
        super(service.name, collapsibleState);
        this.tooltip = `${service.fullName} (${path.basename(service.filePath)})`;
        this.description = path.basename(service.filePath);
        this.contextValue = 'service';
    }
}

// 方法树视图项
class MethodTreeItem extends vscode.TreeItem {
    constructor(
        public readonly method: MethodInfo,
        public readonly service: ServiceInfo
    ) {
        super(method.name, vscode.TreeItemCollapsibleState.None);
        this.tooltip = `${method.name} (${method.requestType} -> ${method.responseType})`;
        this.description = `${method.requestType} -> ${method.responseType}`;
        this.contextValue = 'method';
        
        // 添加命令以便在点击时打开此方法的调用界面
        this.command = {
            command: 'kratos-proto-generator.openGrpcMethod',
            title: '调用 gRPC 方法',
            arguments: [this.service, this.method]
        };
    }
}

// 服务资源管理器数据提供者
export class GrpcServiceProvider implements vscode.TreeDataProvider<ServiceTreeItem | MethodTreeItem> {
    private _onDidChangeTreeData: vscode.EventEmitter<ServiceTreeItem | MethodTreeItem | undefined | null> = new vscode.EventEmitter<ServiceTreeItem | MethodTreeItem | undefined | null>();
    readonly onDidChangeTreeData: vscode.Event<ServiceTreeItem | MethodTreeItem | undefined | null> = this._onDidChangeTreeData.event;
    
    private services: ServiceInfo[] = [];
    
    constructor() {
        this.refreshServices();
    }
    
    // 刷新服务列表
    public async refreshServices(): Promise<void> {
        try {
            this.services = await scanAndParseProtoFiles();
            this._onDidChangeTreeData.fire(null);
        } catch (error) {
            vscode.window.showErrorMessage(`刷新 gRPC 服务失败: ${error}`);
        }
    }
    
    // 获取树项
    getTreeItem(element: ServiceTreeItem | MethodTreeItem): vscode.TreeItem {
        return element;
    }
    
    // 获取子项
    async getChildren(element?: ServiceTreeItem | MethodTreeItem): Promise<(ServiceTreeItem | MethodTreeItem)[]> {
        if (!element) {
            // 根级别: 显示所有服务
            return this.services.map(service => 
                new ServiceTreeItem(service, vscode.TreeItemCollapsibleState.Collapsed)
            );
        } else if (element instanceof ServiceTreeItem) {
            // 服务级别: 显示服务的所有方法
            return element.service.methods.map(method => 
                new MethodTreeItem(method, element.service)
            );
        }
        
        return [];
    }
}

// 注册服务资源管理器
export function registerGrpcExplorer(context: vscode.ExtensionContext): GrpcServiceProvider {
    const grpcServiceProvider = new GrpcServiceProvider();
    
    // 注册视图
    vscode.window.registerTreeDataProvider('kratosGrpcExplorer', grpcServiceProvider);
    
    // 注册刷新命令
    context.subscriptions.push(
        vscode.commands.registerCommand('kratos-proto-generator.refreshGrpcServices', () => 
            grpcServiceProvider.refreshServices()
        )
    );
    
    return grpcServiceProvider;
} 