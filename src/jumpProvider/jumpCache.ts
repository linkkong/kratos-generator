import * as vscode from 'vscode';
import * as fs from 'fs';
import { GoInterface, GoStruct, GoImplementation, GoJumpCache } from '../goTypes';
import { GoASTAnalyzer } from '../goParser/astAnalyzer';
import { MethodMatcher } from '../goParser/methodMatcher';

export class JumpCacheManager {
    private static instance: JumpCacheManager;
    private cache: GoJumpCache;
    private maxCacheSize: number = 1000;
    
    private constructor() {
        this.cache = {
            interfaces: new Map(),
            structs: new Map(),
            implementations: new Map(),
            lastUpdate: new Map()
        };
        
        // 从配置中读取缓存大小
        const config = vscode.workspace.getConfiguration('kratosProtoGenerator');
        this.maxCacheSize = config.get('goJumpCacheSize', 1000);
    }
    
    public static getInstance(): JumpCacheManager {
        if (!JumpCacheManager.instance) {
            JumpCacheManager.instance = new JumpCacheManager();
        }
        return JumpCacheManager.instance;
    }
    
    /**
     * 获取或解析Go文件的接口和结构体信息
     */
    public async getFileInfo(document: vscode.TextDocument): Promise<{ interfaces: GoInterface[], structs: GoStruct[] }> {
        const filePath = document.uri.fsPath;
        const lastModified = await this.getFileLastModified(filePath);
        
        // 检查缓存是否有效
        const cachedTime = this.cache.lastUpdate.get(filePath);
        if (cachedTime && cachedTime >= lastModified) {
            const interfaces = this.cache.interfaces.get(filePath) || [];
            const structs = this.cache.structs.get(filePath) || [];
            return { interfaces, structs };
        }
        
        // 重新解析文件
        const { interfaces, structs } = await GoASTAnalyzer.analyzeGoFile(document);
        
        // 更新缓存
        this.updateCache(filePath, interfaces, structs, lastModified);
        
        return { interfaces, structs };
    }
    
    /**
     * 获取工作区中所有Go文件的接口实现关系
     */
    public async getAllImplementations(): Promise<GoImplementation[]> {
        const workspaceFolders = vscode.workspace.workspaceFolders;
        if (!workspaceFolders) {
            return [];
        }
        
        const allInterfaces: GoInterface[] = [];
        const allStructs: GoStruct[] = [];
        
        // 收集所有Go文件的接口和结构体
        for (const folder of workspaceFolders) {
            const goFiles = await vscode.workspace.findFiles(
                new vscode.RelativePattern(folder, '**/*.go'),
                new vscode.RelativePattern(folder, '**/vendor/**')
            );
            
            for (const file of goFiles) {
                try {
                    const document = await vscode.workspace.openTextDocument(file);
                    const { interfaces, structs } = await this.getFileInfo(document);
                    allInterfaces.push(...interfaces);
                    allStructs.push(...structs);
                } catch (error) {
                    console.error(`Error processing file ${file.fsPath}:`, error);
                }
            }
        }
        
        // 计算实现关系
        return MethodMatcher.findImplementations(allInterfaces, allStructs);
    }
    
    /**
     * 更新文件缓存
     */
    private updateCache(filePath: string, interfaces: GoInterface[], structs: GoStruct[], lastModified: number) {
        // 清理过期缓存
        this.cleanupCache();
        
        this.cache.interfaces.set(filePath, interfaces);
        this.cache.structs.set(filePath, structs);
        this.cache.lastUpdate.set(filePath, lastModified);
    }
    
    /**
     * 清理缓存
     */
    private cleanupCache() {
        const allPaths = [
            ...this.cache.interfaces.keys(),
            ...this.cache.structs.keys(),
            ...this.cache.lastUpdate.keys()
        ];
        
        if (allPaths.length > this.maxCacheSize) {
            // 按最后更新时间排序，删除最旧的条目
            const sortedPaths = allPaths.sort((a, b) => {
                const timeA = this.cache.lastUpdate.get(a) || 0;
                const timeB = this.cache.lastUpdate.get(b) || 0;
                return timeA - timeB;
            });
            
            const toDelete = sortedPaths.slice(0, allPaths.length - this.maxCacheSize);
            for (const path of toDelete) {
                this.cache.interfaces.delete(path);
                this.cache.structs.delete(path);
                this.cache.lastUpdate.delete(path);
            }
        }
    }
    
    /**
     * 获取文件最后修改时间
     */
    private async getFileLastModified(filePath: string): Promise<number> {
        try {
            const stats = await fs.promises.stat(filePath);
            return stats.mtime.getTime();
        } catch (error) {
            return Date.now();
        }
    }
    
    /**
     * 清空所有缓存
     */
    public clearCache() {
        this.cache.interfaces.clear();
        this.cache.structs.clear();
        this.cache.implementations.clear();
        this.cache.lastUpdate.clear();
    }
    
    /**
     * 移除特定文件的缓存
     */
    public removeFileFromCache(filePath: string) {
        this.cache.interfaces.delete(filePath);
        this.cache.structs.delete(filePath);
        this.cache.lastUpdate.delete(filePath);
    }
    
    /**
     * 获取缓存统计信息
     */
    public getCacheStats() {
        return {
            interfaceFiles: this.cache.interfaces.size,
            structFiles: this.cache.structs.size,
            implementationRelations: this.cache.implementations.size,
            lastUpdateEntries: this.cache.lastUpdate.size
        };
    }
} 