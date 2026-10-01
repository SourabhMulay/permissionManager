const vscode = require('vscode');
const { spawn } = require('child_process');
const path = require('path');
const fs = require('fs');
const net = require('net');

let backendProcess = null;
let panel = null;

function checkPython() {
    return new Promise((resolve, reject) => {
        const candidates = ['python3', 'python'];

        function tryNext(index) {
            if (index >= candidates.length) {
                return reject(new Error('not_found'));
            }

            const proc = spawn(candidates[index], ['--version'], { shell: true });

            proc.on('close', code => {
                if (code === 0) resolve(candidates[index]);
                else tryNext(index + 1);
            });

            proc.on('error', () => tryNext(index + 1));
        }

        tryNext(0);
    });
}

async function launchApp(context) {
    const backendDir = path.join(context.extensionPath, 'Backend');
    const requirementsPath = path.join(backendDir, 'requirements.txt');
    const indexHtmlPath = path.join(context.extensionPath, 'FrontEnd', 'index.html');

    // Gate 1: Python must be installed
    try {
        await checkPython();
    } catch {
        const action = await vscode.window.showErrorMessage(
            'Python is not installed or not on PATH. Please install Python 3.8+ to use this feature.',
            'Download Python',
            'Dismiss'
        );
        if (action === 'Download Python') {
            vscode.env.openExternal(vscode.Uri.parse('https://www.python.org/downloads/'));
        }
        return;
    }

    // Gate 2: requirements.txt must exist
    if (!fs.existsSync(requirementsPath)) {
        vscode.window.showErrorMessage('requirements.txt not found in Backend/');
        return;
    }

    // Gate 3: index.html must exist
    if (!fs.existsSync(indexHtmlPath)) {
        vscode.window.showErrorMessage('index.html not found in FrontEnd/');
        return;
    }

    await vscode.window.withProgress(
        {
            location: vscode.ProgressLocation.Notification,
            title: 'Permission Manager',
            cancellable: false
        },
        async (progress) => {
            progress.report({ message: 'Installing Python dependencies...' });

            await installRequirements(backendDir);

            progress.report({ message: 'Starting backend server...' });

            startBackend(backendDir, context);

            progress.report({ message: 'Waiting for server to be ready...' });

            try {
                await waitForPort(8000);
            } catch (err) {
                vscode.window.showErrorMessage(`Backend failed to start: ${err.message}`);
                return;
            }

            vscode.env.openExternal(vscode.Uri.parse('http://localhost:8000'));
        }
    );
}

function installRequirements(backendDir) {
    const candidates = [
        ['pip3', ['install', '-r', 'requirements.txt']],
        ['pip',  ['install', '-r', 'requirements.txt']],
        ['python3', ['-m', 'pip', 'install', '-r', 'requirements.txt']],
        ['python',  ['-m', 'pip', 'install', '-r', 'requirements.txt']],
    ];

    function tryNext(index) {
        if (index >= candidates.length) {
            return Promise.reject(
                new Error('Could not find pip, pip3, python3, or python on PATH. Make sure Python is installed.')
            );
        }

        const [cmd, args] = candidates[index];

        return new Promise((resolve, reject) => {
            const proc = spawn(cmd, args, { cwd: backendDir, shell: true });

            let stderr = '';
            proc.stderr.on('data', data => { stderr += data.toString(); });

            proc.on('close', code => {
                if (code === 0) {
                    resolve();
                } else {
                    // Try next candidate
                    tryNext(index + 1).then(resolve).catch(reject);
                }
            });

            proc.on('error', () => {
                // Command not found — try next
                tryNext(index + 1).then(resolve).catch(reject);
            });
        });
    }

    return tryNext(0);
}

function waitForPort(port, timeout = 15000) {
    return new Promise((resolve, reject) => {
        const start = Date.now();
        function attempt() {
            const socket = new net.Socket();
            socket.setTimeout(500);
            socket.on('connect', () => { socket.destroy(); resolve(); });
            socket.on('error', () => { socket.destroy(); retry(); });
            socket.on('timeout', () => { socket.destroy(); retry(); });
            socket.connect(port, '127.0.0.1');
        }
        function retry() {
            if (Date.now() - start > timeout) {
                reject(new Error(`Server did not start on port ${port} within ${timeout / 1000}s`));
            } else {
                setTimeout(attempt, 300);
            }
        }
        attempt();
    });
}

function startBackend(backendDir, context) {
    if (backendProcess) {
        return; // already running
    }

    // Try `uvicorn` directly first; fall back to `python -m uvicorn`
    const pythonCmd = process.platform === 'win32' ? 'python' : 'python3';
    backendProcess = spawn(
        pythonCmd,
        ['-m', 'uvicorn', 'app.main:app', '--port', '8000'],
        {
            cwd: backendDir,
            shell: true,
            env: { ...process.env, PYTHONPATH: backendDir }
        }
    );

    const outputChannel = vscode.window.createOutputChannel('Permission Manager Backend');
    outputChannel.show(true);

    backendProcess.stdout.on('data', data => {
        outputChannel.append(data.toString());
    });

    backendProcess.stderr.on('data', data => {
        outputChannel.append(data.toString());
    });

    backendProcess.on('close', code => {
        outputChannel.appendLine(`\nBackend stopped (exit code ${code})`);
        backendProcess = null;
    });

    backendProcess.on('error', err => {
        vscode.window.showErrorMessage(`Failed to start backend: ${err.message}`);
        backendProcess = null;
    });

    context.subscriptions.push({
        dispose() {
            if (backendProcess) {
                backendProcess.kill();
                backendProcess = null;
            }
        }
    });
}

function openWebview(indexHtmlPath, context) {
    if (panel) {
        panel.reveal();
        return;
    }

    panel = vscode.window.createWebviewPanel(
        'permissionManagerApp',
        'Permission Manager',
        vscode.ViewColumn.One,
        {
            enableScripts: true,
            localResourceRoots: [
                vscode.Uri.file(path.dirname(indexHtmlPath))
            ],
            retainContextWhenHidden: true
        }
    );

    panel.webview.html = buildWebviewHtml(indexHtmlPath, panel.webview);

    panel.onDidDispose(() => {
        panel = null;
    });
}

function buildWebviewHtml(indexHtmlPath, webview) {
    let html = fs.readFileSync(indexHtmlPath, 'utf8');

    const frontendDir = path.dirname(indexHtmlPath);

    // Rewrite relative src/href paths to vscode-resource URIs
    html = html.replace(
        /(src|href)="(?!https?:\/\/|\/\/|data:)([^"]+)"/g,
        (match, attr, relativePath) => {
            const absPath = path.join(frontendDir, relativePath);
            if (fs.existsSync(absPath)) {
                const uri = webview.asWebviewUri(vscode.Uri.file(absPath));
                return `${attr}="${uri}"`;
            }
            return match;
        }
    );

    // Inject CSP and API base URL so fetch calls reach the local backend from inside the WebView
    const cspSource = webview.cspSource;
    html = html.replace(
        '<head>',
        `<head>\n<meta http-equiv="Content-Security-Policy" content="default-src 'none'; img-src ${cspSource} data: https:; script-src 'unsafe-inline' ${cspSource}; style-src 'unsafe-inline' ${cspSource}; connect-src http://localhost:8000;">\n<script>window.API_BASE = "http://localhost:8000";</script>`
    );

    return html;
}

module.exports = { launchApp };
