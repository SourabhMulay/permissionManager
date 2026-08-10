const vscode = require('vscode');
const { runPermissionManager } = require('./src/commands/permissionManagerCommand');

function activate(context) {
    const disposable = vscode.commands.registerCommand(
        'permissionManager.updatePermissions',
        runPermissionManager
    );

    context.subscriptions.push(disposable);
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};