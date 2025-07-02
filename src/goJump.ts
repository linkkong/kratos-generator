import * as vscode from 'vscode';
import { GoJumpCodeLensProvider } from './jumpProvider/codeLensProvider';
import { GoJumpDefinitionProvider } from './jumpProvider/definitionProvider';
import { JumpCacheManager } from './jumpProvider/jumpCache';
import { MethodMapping } from './goTypes';

export class GoJumpManager {
    private codeLensProvider: GoJumpCodeLensProvider;
    private definitionProvider: GoJumpDefinitionProvider;
    private cacheManager: JumpCacheManager;
    private disposables: vscode.Disposable[] = [];
    
    constructor(private context: vscode.ExtensionContext) {
        this.codeLensProvider = new GoJumpCodeLensProvider();
        this.definitionProvider = new GoJumpDefinitionProvider();
        this.cacheManager = JumpCacheManager.getInstance();
    }
    
    /**
     * 激活Go跳转功能
     */
    public activate(): void {
        const config = vscode.workspace.getConfiguration('kratosProtoGenerator');
        const enabled = config.get('enableGoJump', true);
        
        if (!enabled) {
            return;
        }
        
        // 注册CodeLens提供者
        const codeLensDisposable = vscode.languages.registerCodeLensProvider(
            { scheme: 'file', language: 'go' },
            this.codeLensProvider
        );
        this.disposables.push(codeLensDisposable);
        
        // 注册定义提供者
        const definitionDisposable = vscode.languages.registerDefinitionProvider(
            { scheme: 'file', language: 'go' },
            this.definitionProvider
        );
        this.disposables.push(definitionDisposable);
        
        // 注册命令
        this.registerCommands();
        
        // 监听文件变化
        this.setupFileWatchers();
        
        // 监听配置变化
        this.setupConfigurationListener();
    }
    
    /**
     * 注册相关命令
     */
    private registerCommands(): void {
        // 跳转到实现方法命令
        const gotoImplementationMethodCmd = vscode.commands.registerCommand(
            'kratos-proto-generator.goToImplementationMethod',
            this.goToImplementationMethod.bind(this)
        );
        this.disposables.push(gotoImplementationMethodCmd);
        
        // 跳转到接口方法命令
        const gotoInterfaceMethodCmd = vscode.commands.registerCommand(
            'kratos-proto-generator.goToInterfaceMethod',
            this.goToInterfaceMethod.bind(this)
        );
        this.disposables.push(gotoInterfaceMethodCmd);
        
        // 跳转到结构体命令
        const gotoStructCmd = vscode.commands.registerCommand(
            'kratos-proto-generator.goToStruct',
            this.goToStruct.bind(this)
        );
        this.disposables.push(gotoStructCmd);
        
        // 显示多个实现方法的选择列表
        const showImplementationMethodsCmd = vscode.commands.registerCommand(
            'kratos-proto-generator.showImplementationMethods',
            this.showImplementationMethods.bind(this)
        );
        this.disposables.push(showImplementationMethodsCmd);
        
        // 显示多个接口方法的选择列表
        const showInterfaceMethodsCmd = vscode.commands.registerCommand(
            'kratos-proto-generator.showInterfaceMethods',
            this.showInterfaceMethods.bind(this)
        );
        this.disposables.push(showInterfaceMethodsCmd);
        
        // 显示所有实现的选择列表
        const showAllImplementationsCmd = vscode.commands.registerCommand(
            'kratos-proto-generator.showAllImplementations',
            this.showAllImplementations.bind(this)
        );
        this.disposables.push(showAllImplementationsCmd);
        
        // 刷新缓存命令
        const refreshCacheCmd = vscode.commands.registerCommand(
            'kratos-proto-generator.refreshGoJumpCache',
            this.refreshCache.bind(this)
        );
        this.disposables.push(refreshCacheCmd);
        

    }
    
    /**
     * 跳转到实现方法
     */
    private async goToImplementationMethod(mapping: MethodMapping): Promise<void> {
        try {
            // 找到对应的实现关系来获取文件路径
            const implementations = await this.cacheManager.getAllImplementations();
            const implementation = implementations.find(impl => 
                impl.methodMappings.some(m => m.structMethod === mapping.structMethod)
            );
            
            if (implementation) {
                const uri = vscode.Uri.file(implementation.structFile);
                await vscode.window.showTextDocument(uri, {
                    selection: mapping.structMethod.range,
                    viewColumn: vscode.ViewColumn.Active
                });
            } else {
                vscode.window.showErrorMessage('未找到对应的实现文件');
            }
        } catch (error) {
            vscode.window.showErrorMessage(`跳转到实现失败: ${error}`);
        }
    }
    
    /**
     * 跳转到接口方法
     */
    private async goToInterfaceMethod(mapping: MethodMapping): Promise<void> {
        try {
            // 找到对应的实现关系来获取文件路径
            const implementations = await this.cacheManager.getAllImplementations();
            const implementation = implementations.find(impl => 
                impl.methodMappings.some(m => m.interfaceMethod === mapping.interfaceMethod)
            );
            
            if (implementation) {
                const uri = vscode.Uri.file(implementation.interfaceFile);
                await vscode.window.showTextDocument(uri, {
                    selection: mapping.interfaceMethod.range,
                    viewColumn: vscode.ViewColumn.Active
                });
            } else {
                vscode.window.showErrorMessage('未找到对应的接口文件');
            }
        } catch (error) {
            vscode.window.showErrorMessage(`跳转到接口失败: ${error}`);
        }
    }
    
    /**
     * 跳转到结构体
     */
    private async goToStruct(structName: string, structFile: string): Promise<void> {
        try {
            const uri = vscode.Uri.file(structFile);
            const document = await vscode.workspace.openTextDocument(uri);
            const { structs } = await this.cacheManager.getFileInfo(document);
            
            const targetStruct = structs.find(s => s.name === structName);
            if (targetStruct) {
                await vscode.window.showTextDocument(uri, {
                    selection: targetStruct.range,
                    viewColumn: vscode.ViewColumn.Active
                });
            } else {
                await vscode.window.showTextDocument(uri);
            }
        } catch (error) {
            vscode.window.showErrorMessage(`跳转到结构体失败: ${error}`);
        }
    }
    
    /**
     * 显示多个实现方法的选择列表
     */
    private async showImplementationMethods(implementations: MethodMapping[]): Promise<void> {
        const items = implementations.map(impl => ({
            label: `${impl.structMethod.name}`,
            description: `在结构体中`,
            detail: impl.structMethod.signature,
            mapping: impl
        }));
        
        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: '选择要跳转的实现'
        });
        
        if (selected) {
            await this.goToImplementationMethod(selected.mapping);
        }
    }
    
    /**
     * 显示多个接口方法的选择列表
     */
    private async showInterfaceMethods(interfaces: MethodMapping[]): Promise<void> {
        const items = interfaces.map(intf => ({
            label: `${intf.interfaceMethod.name}`,
            description: `在接口中`,
            detail: intf.interfaceMethod.signature,
            mapping: intf
        }));
        
        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: '选择要跳转的接口'
        });
        
        if (selected) {
            await this.goToInterfaceMethod(selected.mapping);
        }
    }
    
    /**
     * 显示所有实现的选择列表
     */
    private async showAllImplementations(interfaceName: string, implementations: any[]): Promise<void> {
        const items = implementations.map(impl => ({
            label: impl.structName,
            description: `在 ${impl.structFile}`,
            detail: `实现了 ${interfaceName} 接口`,
            impl: impl
        }));
        
        const selected = await vscode.window.showQuickPick(items, {
            placeHolder: `选择 ${interfaceName} 的实现`
        });
        
        if (selected) {
            await this.goToStruct(selected.impl.structName, selected.impl.structFile);
        }
    }
    
    /**
     * 刷新缓存
     */
    private async refreshCache(): Promise<void> {
        try {
            this.cacheManager.clearCache();
            this.codeLensProvider.refresh();
            vscode.window.showInformationMessage('Go跳转缓存已刷新');
        } catch (error) {
            vscode.window.showErrorMessage(`刷新缓存失败: ${error}`);
        }
    }
    

    
    /**
     * 设置文件监听器
     */
    private setupFileWatchers(): void {
        // 监听Go文件变化
        const watcher = vscode.workspace.createFileSystemWatcher('**/*.go');
        
        watcher.onDidCreate(uri => {
            this.cacheManager.removeFileFromCache(uri.fsPath);
            this.codeLensProvider.refresh();
        });
        
        watcher.onDidChange(uri => {
            this.cacheManager.removeFileFromCache(uri.fsPath);
            this.codeLensProvider.refresh();
        });
        
        watcher.onDidDelete(uri => {
            this.cacheManager.removeFileFromCache(uri.fsPath);
            this.codeLensProvider.refresh();
        });
        
        this.disposables.push(watcher);
    }
    
    /**
     * 设置配置监听器
     */
    private setupConfigurationListener(): void {
        const configWatcher = vscode.workspace.onDidChangeConfiguration(e => {
            if (e.affectsConfiguration('kratosProtoGenerator.enableGoJump')) {
                this.codeLensProvider.refresh();
            }
            
            if (e.affectsConfiguration('kratosProtoGenerator.goJumpCacheSize')) {
                // 重新初始化缓存管理器
                this.cacheManager.clearCache();
            }
        });
        
        this.disposables.push(configWatcher);
    }
    
    /**
     * 停用功能
     */
    public deactivate(): void {
        this.disposables.forEach(disposable => disposable.dispose());
        this.disposables = [];
    }
    
    /**
     * 获取缓存统计信息
     */
    public getCacheStats() {
        return this.cacheManager.getCacheStats();
    }
} 