import * as vscode from 'vscode';

export interface GoMethod {
    name: string;
    signature: string;
    params: GoParam[];
    returns: GoParam[];
    position: vscode.Position;
    range: vscode.Range;
}

export interface GoParam {
    name: string;
    type: string;
}

export interface GoInterface {
    name: string;
    methods: GoMethod[];
    position: vscode.Position;
    range: vscode.Range;
    filePath: string;
}

export interface GoStruct {
    name: string;
    methods: GoMethod[];
    position: vscode.Position;
    range: vscode.Range;
    filePath: string;
}

export interface GoImplementation {
    interfaceName: string;
    structName: string;
    interfaceFile: string;
    structFile: string;
    methodMappings: MethodMapping[];
}

export interface MethodMapping {
    interfaceMethod: GoMethod;
    structMethod: GoMethod;
}

export interface JumpInfo {
    type: 'interface' | 'implementation';
    targetFile: string;
    targetPosition: vscode.Position;
    targetRange: vscode.Range;
    description: string;
}

export interface GoJumpCache {
    interfaces: Map<string, GoInterface[]>;
    structs: Map<string, GoStruct[]>;
    implementations: Map<string, GoImplementation[]>;
    lastUpdate: Map<string, number>;
} 