import * as vscode from 'vscode';
import { GoInterface, GoStruct, GoImplementation, MethodMapping } from '../goTypes';
import { GoASTAnalyzer } from './astAnalyzer';

export class MethodMatcher {
    
    /**
     * 查找所有接口的实现
     */
    public static findImplementations(interfaces: GoInterface[], structs: GoStruct[]): GoImplementation[] {
        const implementations: GoImplementation[] = [];
        
        for (const goInterface of interfaces) {
            for (const goStruct of structs) {
                const mappings = this.findMethodMappings(goInterface, goStruct);
                
                // 如果结构体实现了接口的所有方法，则认为是实现关系
                if (mappings.length === goInterface.methods.length && mappings.length > 0) {
                    implementations.push({
                        interfaceName: goInterface.name,
                        structName: goStruct.name,
                        interfaceFile: goInterface.filePath,
                        structFile: goStruct.filePath,
                        methodMappings: mappings
                    });
                }
            }
        }
        
        return implementations;
    }
    
    /**
     * 查找接口和结构体之间的方法映射
     */
    private static findMethodMappings(goInterface: GoInterface, goStruct: GoStruct): MethodMapping[] {
        const mappings: MethodMapping[] = [];
        
        for (const interfaceMethod of goInterface.methods) {
            for (const structMethod of goStruct.methods) {
                if (GoASTAnalyzer.methodsMatch(interfaceMethod, structMethod)) {
                    mappings.push({
                        interfaceMethod: interfaceMethod,
                        structMethod: structMethod
                    });
                    break; // 找到匹配的方法后跳出内层循环
                }
            }
        }
        
        return mappings;
    }
    
    /**
     * 根据方法位置查找对应的接口方法
     */
    public static findInterfaceMethodAt(
        position: vscode.Position, 
        interfaces: GoInterface[]
    ): { interface: GoInterface, method: any } | null {
        for (const goInterface of interfaces) {
            for (const method of goInterface.methods) {
                if (method.range.contains(position)) {
                    return { interface: goInterface, method: method };
                }
            }
        }
        return null;
    }
    
    /**
     * 根据方法位置查找对应的结构体方法
     */
    public static findStructMethodAt(
        position: vscode.Position, 
        structs: GoStruct[]
    ): { struct: GoStruct, method: any } | null {
        for (const goStruct of structs) {
            for (const method of goStruct.methods) {
                if (method.range.contains(position)) {
                    return { struct: goStruct, method: method };
                }
            }
        }
        return null;
    }
    
    /**
     * 查找特定接口方法的所有实现
     */
    public static findImplementationsForInterfaceMethod(
        interfaceName: string,
        methodName: string,
        implementations: GoImplementation[]
    ): MethodMapping[] {
        const results: MethodMapping[] = [];
        
        for (const impl of implementations) {
            if (impl.interfaceName === interfaceName) {
                for (const mapping of impl.methodMappings) {
                    if (mapping.interfaceMethod.name === methodName) {
                        results.push(mapping);
                    }
                }
            }
        }
        
        return results;
    }
    
    /**
     * 查找特定结构体方法对应的接口方法
     */
    public static findInterfaceForStructMethod(
        structName: string,
        methodName: string,
        implementations: GoImplementation[]
    ): MethodMapping[] {
        const results: MethodMapping[] = [];
        
        for (const impl of implementations) {
            if (impl.structName === structName) {
                for (const mapping of impl.methodMappings) {
                    if (mapping.structMethod.name === methodName) {
                        results.push(mapping);
                    }
                }
            }
        }
        
        return results;
    }
    
    /**
     * 检查结构体是否完全实现了接口
     */
    public static isCompleteImplementation(goInterface: GoInterface, goStruct: GoStruct): boolean {
        const mappings = this.findMethodMappings(goInterface, goStruct);
        return mappings.length === goInterface.methods.length;
    }
    
    /**
     * 获取结构体未实现的接口方法
     */
    public static getMissingMethods(goInterface: GoInterface, goStruct: GoStruct): any[] {
        const mappings = this.findMethodMappings(goInterface, goStruct);
        const implementedMethods = new Set(mappings.map(m => m.interfaceMethod.name));
        
        return goInterface.methods.filter(method => !implementedMethods.has(method.name));
    }
} 