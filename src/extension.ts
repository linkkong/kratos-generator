import * as vscode from 'vscode';
import * as path from 'path';
import * as cp from 'child_process';

export function activate(context: vscode.ExtensionContext) {
    let disposable = vscode.commands.registerCommand('kratos-proto-generator.generateProto', async (uri: vscode.Uri) => {
        try {
            // 获取文件所在目录
            const fileDir = path.dirname(uri.fsPath);
            const fileName = path.basename(uri.fsPath);

            // 显示进度提示
            await vscode.window.withProgress({
                location: vscode.ProgressLocation.Notification,
                title: "Generating Proto",
                cancellable: false
            }, async (progress) => {
                progress.report({ message: "Running kratos proto client command..." });

                // 执行 kratos proto client 命令
                return new Promise<void>((resolve, reject) => {
                    const command = `kratos proto client ${fileName}`;
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

    context.subscriptions.push(disposable);
}

export function deactivate() {} 