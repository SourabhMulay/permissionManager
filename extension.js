const vscode = require('vscode');
const { runPermissionManager } = require('./src/commands/permissionManagerCommand');
const { launchApp } = require('./src/commands/launchAppCommand');

function activate(context) {
    context.subscriptions.push(
        vscode.commands.registerCommand(
            'permissionManager.updatePermissions',
            runPermissionManager
        )
    );

    context.subscriptions.push(
        vscode.commands.registerCommand(
            'permissionManager.launchApp',
            () => launchApp(context)
        )
    );
}

function deactivate() {}

module.exports = {
    activate,
    deactivate
};