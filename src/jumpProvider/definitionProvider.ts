import * as vscode from 'vscode';
import { GoInterface, GoStruct, GoImplementation, MethodMapping } from '../goTypes';
import { JumpCacheManager } from './jumpCache';
import { MethodMatcher } from '../goParser/methodMatcher';

export class GoJumpDefinitionProvider implements vscode.DefinitionProvider {
    private cacheManager: JumpCacheManager;
    
    constructor() {
        this.cacheManager = JumpCacheManager.getInstance();
    }
    
    public async provideDefinition(
        document: vscode.TextDocument,
        position: vscode.Position,
        token: vscode.CancellationToken
    ): Promise<vscode.Definition | undefined> {
        const config = vscode.workspace.getConfiguration('kratosProtoGenerator');
        const enabled = config.get('enableGoJump', true);
        
        if (!enabled || document.languageId !== 'go') {
            return undefined;
        }
        
        try {
            // 获取当前文件的接口和结构体信息
            const { interfaces, structs } = await this.cacheManager.getFileInfo(document);
            
            // 获取所有实现关系
            const implementations = await this.cacheManager.getAllImplementations();
            
            // 检查是否在接口方法上
            const interfaceMethod = MethodMatcher.findInterfaceMethodAt(position, interfaces);
            if (interfaceMethod) {
                return this.getImplementationDefinitions(interfaceMethod.interface, interfaceMethod.method, implementations);
            }
            
            // 检查是否在结构体方法上
            const structMethod = MethodMatcher.findStructMethodAt(position, structs);
            if (structMethod) {
                return this.getInterfaceDefinitions(structMethod.struct, structMethod.method, implementations);
            }
            
        } catch (error) {
            console.error('Error providing definition:', error);
        }
        
        return undefined;
    }
    
    /**
     * 获取接口方法的实现定义
     */
    private getImplementationDefinitions(
        goInterface: GoInterface, 
        method: any, 
        implementations: GoImplementation[]
    ): vscode.Definition {
        const impls = MethodMatcher.findImplementationsForInterfaceMethod(
            goInterface.name, 
            method.name, 
            implementations
        );
        
        const definitions: vscode.Location[] = [];
        
        for (const mapping of impls) {
            // 找到对应的实现关系来获取文件路径
            const implementation = implementations.find(impl => 
                impl.interfaceName === goInterface.name && 
                impl.methodMappings.some(m => m.structMethod === mapping.structMethod)
            );
            
            if (implementation) {
                const uri = vscode.Uri.file(implementation.structFile);
                const location = new vscode.Location(uri, mapping.structMethod.range);
                definitions.push(location);
            }
        }
        
        return definitions;
    }
    
    /**
     * 获取结构体方法的接口定义
     */
    private getInterfaceDefinitions(
        goStruct: GoStruct, 
        method: any, 
        implementations: GoImplementation[]
    ): vscode.Definition {
        const interfaces = MethodMatcher.findInterfaceForStructMethod(
            goStruct.name, 
            method.name, 
            implementations
        );
        
        const definitions: vscode.Location[] = [];
        
        for (const mapping of interfaces) {
            // 找到对应的实现关系来获取文件路径
            const implementation = implementations.find(impl => 
                impl.structName === goStruct.name && 
                impl.methodMappings.some(m => m.interfaceMethod === mapping.interfaceMethod)
            );
            
            if (implementation) {
                const uri = vscode.Uri.file(implementation.interfaceFile);
                const location = new vscode.Location(uri, mapping.interfaceMethod.range);
                definitions.push(location);
            }
        }
        
        return definitions;
    }
} 