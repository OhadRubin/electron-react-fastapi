const { app, Menu, Tray, nativeImage, dialog, ipcMain } = require('electron');
const path = require('path');
const { spawn } = require('child_process');
const isDev = require('electron-is-dev');
const fs = require('fs');

let tray = null;
let serverProcess = null;
let serverRunning = false;
let reactAppProcess = null;
let reactAppRunning = false;

// Check if the app was launched at login or manually
const isRunningAtLogin = process.argv.includes('--launched-at-login');

// Set app to launch at startup
function setAutoLaunch(enable) {
    if (!app.isPackaged && process.platform !== 'darwin') {
        console.log('Auto launch only works in packaged app');
        return;
    }

    app.setLoginItemSettings({
        openAtLogin: enable,
        openAsHidden: true,
        args: ['--launched-at-login']
    });

    console.log(`Auto launch ${enable ? 'enabled' : 'disabled'}`);
}

// Get the path to the packaged FastAPI executable
function getServerPath() {
    if (isDev) {
        // In development mode
        return path.join(__dirname, 'server.py');
    } else {
        // In production/packaged mode - extraResources are placed in the app.getPath('userData')
        // or in the resources directory
        return path.join(process.resourcesPath, 'server.py');
    }
}

function startServer() {
    if (serverRunning) return;

    const serverPath = getServerPath();
    console.log(`Starting server from: ${serverPath}`);

    try {
        // First check if the server.py file exists
        if (!fs.existsSync(serverPath)) {
            console.error(`Server file not found at: ${serverPath}`);
            dialog.showErrorBox('Server Error',
                `Could not find server.py at ${serverPath}. Please make sure the file exists.`);
            return;
        }

        // Always use the user's specific Python path
        console.log(`Using Python at: /Users/ohadr/.pyenv/shims/python`);
        serverProcess = spawn('/Users/ohadr/.pyenv/shims/python', [serverPath]);

        serverProcess.stdout.on('data', (data) => {
            console.log(`Server stdout: ${data}`);
        });

        serverProcess.stderr.on('data', (data) => {
            console.error(`Server stderr: ${data}`);
        });

        serverProcess.on('close', (code) => {
            console.log(`Server process exited with code ${code}`);
            serverRunning = false;
            updateTrayMenu();

            if (code !== 0 && code !== null) {
                let errorMessage = `The FastAPI server crashed with code ${code}.`;

                if (code === 2) {
                    errorMessage += `\n\nThis may be due to missing Python dependencies. Please run:\npip install fastapi uvicorn pydantic`;
                }

                dialog.showErrorBox('Server Error', errorMessage);
            }
        });

        serverRunning = true;
        updateTrayMenu();

        // Start React app automatically when server starts
        if (!reactAppRunning) {
            setTimeout(() => {
                startReactApp();
            }, 1000); // Give the server a second to fully initialize before starting React
        }
    } catch (error) {
        console.error('Failed to start server:', error);
        dialog.showErrorBox('Server Error',
            `Failed to start the FastAPI server: ${error.message}`);
    }
}

function stopServer() {
    if (!serverRunning || !serverProcess) return;

    console.log('Stopping server...');

    // On Windows, you might need a different approach
    if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', serverProcess.pid, '/f', '/t']);
    } else {
        serverProcess.kill();
    }

    serverProcess = null;
    serverRunning = false;
    updateTrayMenu();
}

// Start the React app using npm start
function startReactApp() {
    if (reactAppRunning) return;

    const reactAppPath = path.join(__dirname, 'current_task');
    console.log(`Starting React app from: ${reactAppPath}`);

    try {
        // Check if the React app directory exists
        if (!fs.existsSync(reactAppPath)) {
            console.error(`React app not found at: ${reactAppPath}`);
            dialog.showErrorBox('React App Error',
                `Could not find React app at ${reactAppPath}. Please make sure the directory exists.`);
            return;
        }

        // Start the React development server
        reactAppProcess = spawn('npm', ['start'], {
            cwd: reactAppPath,
            shell: true,
            env: {...process.env, BROWSER: 'none' } // Prevent automatic browser opening
        });

        reactAppProcess.stdout.on('data', (data) => {
            console.log(`React app stdout: ${data}`);
            // Check if the app has started successfully
            if (data.toString().includes('Local:') || data.toString().includes('localhost:')) {
                reactAppRunning = true;
                updateTrayMenu();
            }
        });

        reactAppProcess.stderr.on('data', (data) => {
            console.error(`React app stderr: ${data}`);
        });

        reactAppProcess.on('close', (code) => {
            console.log(`React app process exited with code ${code}`);
            reactAppRunning = false;
            updateTrayMenu();

            if (code !== 0 && code !== null) {
                dialog.showErrorBox('React App Error',
                    `The React app crashed with code ${code}. Please check the console for more information.`);
            }
        });

    } catch (error) {
        console.error('Failed to start React app:', error);
        dialog.showErrorBox('React App Error',
            `Failed to start the React app: ${error.message}`);
    }
}

function stopReactApp() {
    if (!reactAppRunning || !reactAppProcess) return;

    console.log('Stopping React app...');

    // On Windows, you might need a different approach
    if (process.platform === 'win32') {
        spawn('taskkill', ['/pid', reactAppProcess.pid, '/f', '/t']);
    } else {
        reactAppProcess.kill();
    }

    reactAppProcess = null;
    reactAppRunning = false;
    updateTrayMenu();
}

function updateTrayMenu() {
    const autoLaunchEnabled = app.getLoginItemSettings().openAtLogin;

    const contextMenu = Menu.buildFromTemplate([{
            label: serverRunning ? 'Stop Server' : 'Start Server',
            click: serverRunning ? stopServer : startServer
        },
        { type: 'separator' },
        {
            label: 'Open FastAPI Interface',
            click: () => {
                if (serverRunning) {
                    // First ensure the React app is running
                    if (!reactAppRunning) {
                        startReactApp();
                        // Wait a moment for the React app to start before opening the browser
                        setTimeout(() => {
                            require('electron').shell.openExternal('http://localhost:3000');
                        }, 5000); // Wait 5 seconds for the React app to start
                    } else {
                        require('electron').shell.openExternal('http://localhost:3000');
                    }
                } else {
                    dialog.showMessageBox({
                        type: 'info',
                        title: 'Server Not Running',
                        message: 'The server is not running. Please start the server first.',
                        buttons: ['Start Server', 'Cancel'],
                    }).then(result => {
                        if (result.response === 0) {
                            startServer();
                            // Start React app after server
                            setTimeout(() => {
                                startReactApp();
                                setTimeout(() => {
                                    require('electron').shell.openExternal('http://localhost:3000');
                                }, 5000);
                            }, 2000);
                        }
                    });
                }
            },
            enabled: serverRunning
        },
        {
            label: reactAppRunning ? 'Stop React App' : 'Start React App',
            click: reactAppRunning ? stopReactApp : startReactApp,
            enabled: serverRunning
        },
        { type: 'separator' },
        {
            label: autoLaunchEnabled ? 'Disable Auto-start' : 'Enable Auto-start',
            click: () => setAutoLaunch(!autoLaunchEnabled)
        },
        { type: 'separator' },
        { label: 'Quit', click: () => app.quit() }
    ]);

    tray.setContextMenu(contextMenu);

    // Update tray icon or tooltip based on server status
    tray.setToolTip(`FastAPI Server ${serverRunning ? '(Running)' : '(Stopped)'}`);
}

app.whenReady().then(() => {
    // Create tray icon with better fallback
    const iconPath = path.join(__dirname, 'icon.png');
    console.log(`Looking for icon at: ${iconPath}`);
    console.log(`Icon exists: ${fs.existsSync(iconPath)}`);

    let icon;
    try {
        // Try to load the icon
        icon = nativeImage.createFromPath(iconPath);

        // Resize the icon to an appropriate size for the tray (16x16 or 32x32)
        if (!icon.isEmpty()) {
            // Create a smaller version for the tray
            const trayIconSize = process.platform === 'darwin' ? 16 : 32; // macOS uses 16px, Windows/Linux 32px
            icon = icon.resize({ width: trayIconSize, height: trayIconSize });
            console.log(`Resized icon to ${trayIconSize}x${trayIconSize} for tray`);
        }
        // If icon is empty, create a simple square icon
        else {
            console.log('Creating fallback icon');
            // Create a simple 16x16 icon
            icon = nativeImage.createEmpty();
            const size = { width: 16, height: 16 };

            // For simplicity use a solid color icon
            const buffer = Buffer.alloc(size.width * size.height * 4);
            let pos = 0;
            for (let i = 0; i < size.width * size.height; i++) {
                buffer[pos++] = 0; // R
                buffer[pos++] = 120; // G
                buffer[pos++] = 220; // B
                buffer[pos++] = 255; // A
            }

            icon = nativeImage.createFromBuffer(buffer, size);
        }
    } catch (error) {
        console.error('Error creating icon:', error);
        icon = nativeImage.createEmpty();
    }

    console.log(`Icon is empty after processing: ${icon.isEmpty()}`);

    // Setup IPC handlers
    ipcMain.handle('start-server', async() => {
        startServer();
        return { success: true };
    });

    ipcMain.handle('stop-server', async() => {
        stopServer();
        return { success: true };
    });

    ipcMain.handle('get-server-status', async() => {
        return { running: serverRunning };
    });

    ipcMain.handle('start-react-app', async() => {
        startReactApp();
        return { success: true };
    });

    ipcMain.handle('stop-react-app', async() => {
        stopReactApp();
        return { success: true };
    });

    ipcMain.handle('get-react-app-status', async() => {
        return { running: reactAppRunning };
    });

    // Create the tray with our icon
    tray = new Tray(icon);
    console.log('Tray created');

    // Enable auto-launch by default (user can disable later)
    if (app.isPackaged) {
        setAutoLaunch(true);
    }

    updateTrayMenu();
    console.log('Tray menu updated');

    // Start the server automatically on app launch
    startServer();
    console.log('Server started automatically');

    // Hide dock icon on macOS
    if (process.platform === 'darwin' && app.dock) {
        app.dock.hide();
        console.log('Dock hidden');
    }
});

// Make sure to stop the server before quitting
app.on('before-quit', () => {
    stopReactApp();
    stopServer();
});