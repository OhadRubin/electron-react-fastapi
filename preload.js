const { contextBridge, ipcRenderer } = require('electron');

contextBridge.exposeInMainWorld('electronAPI', {
    startServer: () => ipcRenderer.invoke('start-server'),
    stopServer: () => ipcRenderer.invoke('stop-server'),
    getServerStatus: () => ipcRenderer.invoke('get-server-status'),
    startReactApp: () => ipcRenderer.invoke('start-react-app'),
    stopReactApp: () => ipcRenderer.invoke('stop-react-app'),
    getReactAppStatus: () => ipcRenderer.invoke('get-react-app-status')
});