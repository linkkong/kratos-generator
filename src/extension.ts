import * as vscode from 'vscode';
import * as path from 'path';
import * as cp from 'child_process';

export function activate(context: vscode.ExtensionContext) {
    // 生成 proto 命令
    let generateProtoDisposable = vscode.commands.registerCommand('kratos-proto-generator.generateProto', async (uri: vscode.Uri) => {
        try {
            const fileDir = path.dirname(uri.fsPath);
            const fileName = path.basename(uri.fsPath);

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Generating Proto",
                cancellable: false
            }, async (progress) => {
                progress.report({ message: "Running kratos proto client command..." });

                return new Promise<void>((resolve, reject) => {
                    const command = `kratos proto client ${fileName}`;
                    vscode.window.showInformationMessage(`执行目录: ${fileDir}\n执行命令: ${command}`);
                    cp.exec(command, { cwd: fileDir }, (error, stdout, stderr) => {
                        if (error) {
                            vscode.window.showErrorMessage(`Error: ${error.message}`);
                            reject(error);
                        } else {
                            vscode.window.showInformationMessage('Proto generated successfully!');
                            resolve();
                        }
                    });
                });
            });
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

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Generating Service",
                cancellable: false
            }, async (progress) => {
                progress.report({ message: "Running kratos proto server command..." });

                return new Promise<void>((resolve, reject) => {
                    const command = `kratos proto server ${protoPath} -t internal/service`;
                    vscode.window.showInformationMessage(`执行目录: ${workspaceFolder.uri.fsPath}\n执行命令: ${command}`);
                    cp.exec(command, { cwd: workspaceFolder.uri.fsPath }, (error, stdout, stderr) => {
                        if (error) {
                            vscode.window.showErrorMessage(`Error: ${error.message}`);
                            reject(error);
                        } else {
                            vscode.window.showInformationMessage('Service generated successfully!');
                            resolve();
                        }
                    });
                });
            });
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

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Generating Config",
                cancellable: false
            }, async (progress) => {
                progress.report({ message: "Running make config command..." });

                return new Promise<void>((resolve, reject) => {
                    const command = `make config`;
                    vscode.window.showInformationMessage(`执行目录: ${workspaceFolder.uri.fsPath}\n执行命令: ${command}`);
                    cp.exec(command, { cwd: workspaceFolder.uri.fsPath }, (error, stdout, stderr) => {
                        if (error) {
                            vscode.window.showErrorMessage(`Error: ${error.message}`);
                            reject(error);
                        } else {
                            vscode.window.showInformationMessage('Config generated successfully!');
                            resolve();
                        }
                    });
                });
            });
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to generate config: ${error}`);
        }
    });

    // 执行 wire 命令
    let runWireDisposable = vscode.commands.registerCommand('kratos-proto-generator.runWire', async (uri: vscode.Uri) => {
        try {
            // 在这里设置断点，查看 uri 的值
            console.log('Wire command triggered with URI:', uri.fsPath);
            
            const workspaceFolder = vscode.workspace.workspaceFolders?.[0];
            if (!workspaceFolder) {
                throw new Error('No workspace folder found');
            }

            // 获取目标目录路径
            const targetDir = uri.fsPath;

            // 在这里设置断点，查看路径信息
            console.log('Workspace folder:', workspaceFolder.uri.fsPath);
            console.log('Target directory:', targetDir);

            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Running Wire",
                cancellable: false
            }, async (progress) => {
                progress.report({ message: "Running wire command..." });

                return new Promise<void>((resolve, reject) => {
                    const command = `wire`;
                    vscode.window.showInformationMessage(`执行目录: ${targetDir}\n执行命令: ${command}`);
                    cp.exec(command, { cwd: targetDir }, (error, stdout, stderr) => {
                        if (error) {
                            vscode.window.showErrorMessage(`Error: ${error.message}`);
                            reject(error);
                        } else {
                            vscode.window.showInformationMessage('Wire executed successfully!');
                            resolve();
                        }
                    });
                });
            });
        } catch (error) {
            vscode.window.showErrorMessage(`Failed to run wire: ${error}`);
        }
    });

    context.subscriptions.push(generateProtoDisposable, generateServiceDisposable, generateConfigDisposable, runWireDisposable);
}

export function deactivate() {} 