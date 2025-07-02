import * as vscode from 'vscode';
import { GoInterface, GoStruct, GoImplementation, MethodMapping } from '../goTypes';
import { JumpCacheManager } from './jumpCache';
import { MethodMatcher } from '../goParser/methodMatcher';

export class GoJumpCodeLensProvider implements vscode.CodeLensProvider {
    private _onDidChangeCodeLenses: vscode.EventEmitter<void> = new vscode.EventEmitter<void>();
    public readonly onDidChangeCodeLenses: vscode.Event<void> = this._onDidChangeCodeLenses.event;
    
    private cacheManager: JumpCacheManager;
    
    constructor() {
        this.cacheManager = JumpCacheManager.getInstance();
    }
    
    public async provideCodeLenses(document: vscode.TextDocument, token: vscode.CancellationToken): Promise<vscode.CodeLens[]> {
        console.log(`[GoJump] CodeLens开始处理文件: ${document.fileName}`);
        
        const config = vscode.workspace.getConfiguration('kratosProtoGenerator');
        const enabled = config.get('enableGoJump', true);
        
        if (!enabled || document.languageId !== 'go') {
            console.log(`[GoJump] CodeLens跳过文件: enabled=${enabled}, language=${document.languageId}`);
            return [];
        }
        
        const codeLenses: vscode.CodeLens[] = [];
        
        try {
            // 获取当前文件的接口和结构体信息
            const { interfaces, structs } = await this.cacheManager.getFileInfo(document);
            console.log(`[GoJump] CodeLens获得: ${interfaces.length}个接口, ${structs.length}个结构体`);
            
            // 详细输出接口信息
            interfaces.forEach(intf => {
                console.log(`[GoJump] 接口详情: ${intf.name}, 方法数: ${intf.methods.length}`);
                intf.methods.forEach(method => {
                    console.log(`[GoJump] - 方法: ${method.name}, 签名: ${method.signature}`);
                });
            });
            
            // 详细输出结构体信息
            structs.forEach(struct => {
                console.log(`[GoJump] 结构体详情: ${struct.name}, 方法数: ${struct.methods.length}`);
                struct.methods.forEach(method => {
                    console.log(`[GoJump] - 方法: ${method.name}, 签名: ${method.signature}`);
                });
            });
            
            // 获取所有实现关系
            const implementations = await this.cacheManager.getAllImplementations();
            console.log(`[GoJump] 找到 ${implementations.length} 个实现关系`);
            
            // 详细输出实现关系
            implementations.forEach(impl => {
                console.log(`[GoJump] 实现关系: ${impl.interfaceName} -> ${impl.structName}`);
                console.log(`[GoJump] - 接口文件: ${impl.interfaceFile}`);
                console.log(`[GoJump] - 结构体文件: ${impl.structFile}`);
                console.log(`[GoJump] - 方法映射数: ${impl.methodMappings.length}`);
                impl.methodMappings.forEach(mapping => {
                    console.log(`[GoJump]   - ${mapping.interfaceMethod.name} -> ${mapping.structMethod.name}`);
                });
            });
            
            // 为接口方法添加CodeLens（只有找到实现时才添加）
            const interfaceCodeLenses = this.createInterfaceCodeLenses(interfaces, implementations);
            console.log(`[GoJump] 创建了 ${interfaceCodeLenses.length} 个接口方法CodeLens`);
            codeLenses.push(...interfaceCodeLenses);
            
            // 为结构体方法添加CodeLens（只有找到接口时才添加）
            const structCodeLenses = this.createStructCodeLenses(structs, implementations);
            console.log(`[GoJump] 创建了 ${structCodeLenses.length} 个结构体方法CodeLens`);
            codeLenses.push(...structCodeLenses);
            
            // 为接口定义本身添加CodeLens（显示所有实现该接口的结构体）
            const interfaceDefCodeLenses = this.createInterfaceDefinitionCodeLenses(interfaces, implementations);
            console.log(`[GoJump] 创建了 ${interfaceDefCodeLenses.length} 个接口定义CodeLens`);
            codeLenses.push(...interfaceDefCodeLenses);
            
        } catch (error) {
            console.error('[GoJump] CodeLens提供错误:', error);
            if (error instanceof Error) {
                console.error('[GoJump] 错误堆栈:', error.stack);
            }
        }
        
        console.log(`[GoJump] CodeLens总共创建了${codeLenses.length}个`);
        return codeLenses;
    }
    
    /**
     * 为接口方法创建CodeLens
     */
    private createInterfaceCodeLenses(interfaces: GoInterface[], implementations: GoImplementation[]): vscode.CodeLens[] {
        const codeLenses: vscode.CodeLens[] = [];
        
        for (const goInterface of interfaces) {
            for (const method of goInterface.methods) {
                const impls = MethodMatcher.findImplementationsForInterfaceMethod(
                    goInterface.name, 
                    method.name, 
                    implementations
                );
                
                // 只有找到实现时才创建CodeLens
                if (impls.length > 0) {
                    console.log(`[GoJump] 为接口方法创建CodeLens: ${goInterface.name}.${method.name} (${impls.length}个实现)`);
                    
                    const range = new vscode.Range(
                        method.position.line,
                        0, // 从行首开始
                        method.position.line,
                        method.position.character + method.name.length
                    );
                    
                    const command = this.createGotoImplementationCommand(impls);
                    const codeLens = new vscode.CodeLens(range, command);
                    codeLenses.push(codeLens);
                } else {
                    console.log(`[GoJump] 接口方法无实现，跳过: ${goInterface.name}.${method.name}`);
                }
            }
        }
        
        return codeLenses;
    }
    
    /**
     * 为结构体方法创建CodeLens
     */
    private createStructCodeLenses(structs: GoStruct[], implementations: GoImplementation[]): vscode.CodeLens[] {
        const codeLenses: vscode.CodeLens[] = [];
        
        for (const goStruct of structs) {
            for (const method of goStruct.methods) {
                const interfaces = MethodMatcher.findInterfaceForStructMethod(
                    goStruct.name, 
                    method.name, 
                    implementations
                );
                
                // 只有找到接口时才创建CodeLens
                if (interfaces.length > 0) {
                    console.log(`[GoJump] 为结构体方法创建CodeLens: ${goStruct.name}.${method.name} (${interfaces.length}个接口)`);
                    
                    const range = new vscode.Range(
                        method.position.line,
                        0, // 从行首开始
                        method.position.line,
                        method.position.character + method.name.length
                    );
                    
                    const command = this.createGotoInterfaceCommand(interfaces);
                    const codeLens = new vscode.CodeLens(range, command);
                    codeLenses.push(codeLens);
                } else {
                    console.log(`[GoJump] 结构体方法无接口，跳过: ${goStruct.name}.${method.name}`);
                }
            }
        }
        
        return codeLenses;
    }
    
    /**
     * 为接口定义创建CodeLens（显示实现该接口的所有结构体）
     */
    private createInterfaceDefinitionCodeLenses(interfaces: GoInterface[], implementations: GoImplementation[]): vscode.CodeLens[] {
        const codeLenses: vscode.CodeLens[] = [];
        
        for (const goInterface of interfaces) {
            const interfaceImpls = implementations.filter(impl => impl.interfaceName === goInterface.name);
            
            if (interfaceImpls.length > 0) {
                console.log(`[GoJump] 为接口定义创建CodeLens: ${goInterface.name} (${interfaceImpls.length}个实现)`);
                
                const range = new vscode.Range(
                    goInterface.position.line,
                    0,
                    goInterface.position.line,
                    goInterface.position.character + goInterface.name.length
                );
                
                let command: vscode.Command;
                if (interfaceImpls.length === 1) {
                    const impl = interfaceImpls[0];
                    command = {
                        title: `$(symbol-class) 跳转到实现: ${impl.structName}`,
                        command: 'kratos-proto-generator.goToStruct',
                        arguments: [impl.structName, impl.structFile]
                    };
                } else {
                    command = {
                        title: `$(symbol-class) ${interfaceImpls.length} 个实现`,
                        command: 'kratos-proto-generator.showAllImplementations',
                        arguments: [goInterface.name, interfaceImpls]
                    };
                }
                
                const codeLens = new vscode.CodeLens(range, command);
                codeLenses.push(codeLens);
            }
        }
        
        return codeLenses;
    }
    
    /**
     * 创建跳转到实现的命令
     */
    private createGotoImplementationCommand(implementations: MethodMapping[]): vscode.Command {
        if (implementations.length === 1) {
            const impl = implementations[0];
            return {
                title: `$(arrow-right) 跳转到实现`,
                command: 'kratos-proto-generator.goToImplementationMethod',
                arguments: [impl]
            };
        } else {
            return {
                title: `$(arrow-right) ${implementations.length} 个实现`,
                command: 'kratos-proto-generator.showImplementationMethods',
                arguments: [implementations]
            };
        }
    }
    
    /**
     * 创建跳转到接口的命令
     */
    private createGotoInterfaceCommand(interfaces: MethodMapping[]): vscode.Command {
        if (interfaces.length === 1) {
            const intf = interfaces[0];
            return {
                title: `$(arrow-left) 跳转到接口`,
                command: 'kratos-proto-generator.goToInterfaceMethod',
                arguments: [intf]
            };
        } else {
            return {
                title: `$(arrow-left) ${interfaces.length} 个接口`,
                command: 'kratos-proto-generator.showInterfaceMethods',
                arguments: [interfaces]
            };
        }
    }
    
    /**
     * 解析CodeLens命令
     */
    public resolveCodeLens(codeLens: vscode.CodeLens, token: vscode.CancellationToken): vscode.ProviderResult<vscode.CodeLens> {
        return codeLens;
    }
    
    /**
     * 刷新CodeLens
     */
    public refresh(): void {
        console.log('[GoJump] 刷新CodeLens');
        this._onDidChangeCodeLenses.fire();
    }
} 