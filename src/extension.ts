import * as vscode from 'vscode';
import * as path from 'path';

export function activate(context: vscode.ExtensionContext) {
    // 生成 proto 命令
    let generateProtoDisposable = vscode.commands.registerCommand('kratos-proto-generator.generateProto', async (uri: vscode.Uri) => {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                throw new Error('No workspace folder found');
            }

            const relativePath = path.relative(workspaceFolder.uri.fsPath, uri.fsPath);
            const protoPath = relativePath.replace(/\\/g, '/');
            const command = `kratos proto client ${protoPath}`;

            // 创建终端并执行命令
            const terminal = vscode.window.createTerminal('Kratos Generator');
            terminal.show();
            terminal.sendText(command);

            vscode.window.showInformationMessage(`执行目录: ${workspaceFolder.uri.fsPath}\n执行命令: ${command}`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to generate proto: ${error}`);
        }
    });

    // 生成 service 命令
    let generateServiceDisposable = vscode.commands.registerCommand('kratos-proto-generator.generateService', async (uri: vscode.Uri) => {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                throw new Error('No workspace folder found');
            }

            const relativePath = path.relative(workspaceFolder.uri.fsPath, uri.fsPath);
            const protoPath = relativePath.replace(/\\/g, '/');
            const command = `kratos proto server ${protoPath} -t internal/service`;

            // 创建终端并执行命令
            const terminal = vscode.window.createTerminal('Kratos Generator');
            terminal.show();
            terminal.sendText(command);

            vscode.window.showInformationMessage(`执行目录: ${workspaceFolder.uri.fsPath}\n执行命令: ${command}`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to generate service: ${error}`);
        }
    });

    // 生成配置文件命令
    let generateConfigDisposable = vscode.commands.registerCommand('kratos-proto-generator.generateConfig', async (uri: vscode.Uri) => {
        try {
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                throw new Error('No workspace folder found');
            }

            const command = `make config`;

            // 创建终端并执行命令
            const terminal = vscode.window.createTerminal('Kratos Generator');
            terminal.show();
            terminal.sendText(command);

            vscode.window.showInformationMessage(`执行目录: ${workspaceFolder.uri.fsPath}\n执行命令: ${command}`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to generate config: ${error}`);
        }
    });

    // 执行 wire 命令
    let runWireDisposable = vscode.commands.registerCommand('kratos-proto-generator.runWire', async (uri: vscode.Uri) => {
        try {
            if (!uri) {
                throw new Error('请在目录上右键执行此命令');
            }

            const targetPath = uri.fsPath;
            const command = `wire .`;

            // 创建终端并执行命令
            const terminal = vscode.window.createTerminal('Kratos Generator');
            terminal.show();
            terminal.sendText(`cd "${targetPath}"`);
            terminal.sendText(command);

            vscode.window.showInformationMessage(`执行目录: ${targetPath}\n执行命令: ${command}`);
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to run wire: ${error}`);
        }
    });

    context.subscriptions.push(generateProtoDisposable, generateServiceDisposable, generateConfigDisposable, runWireDisposable);
}

export function deactivate() {} 