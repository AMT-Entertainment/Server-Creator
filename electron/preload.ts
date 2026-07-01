import { contextBridge, ipcRenderer } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  // Server list
  getServers: () => ipcRenderer.invoke('servers:list'),
  getServer: (id: string) => ipcRenderer.invoke('servers:get', id),
  createServer: (config: any) => ipcRenderer.invoke('servers:create', config),
  deleteServer: (id: string) => ipcRenderer.invoke('servers:delete', id),

  // Server lifecycle
  startServer: (id: string) => ipcRenderer.invoke('server:start', id),
  stopServer: (id: string) => ipcRenderer.invoke('server:stop', id),
  restartServer: (id: string) => ipcRenderer.invoke('server:restart', id),
  sendCommand: (id: string, command: string) => ipcRenderer.invoke('server:command', id, command),
  getServerStatus: (id: string) => ipcRenderer.invoke('server:status', id),

  // Terminal
  getTerminalOutput: (id: string) => ipcRenderer.invoke('server:terminal:get', id),
  listenToTerminal: (id: string) => ipcRenderer.invoke('server:terminal:listen', id),

  // Logs
  getLogs: (id: string) => ipcRenderer.invoke('server:logs:get', id),
  clearLogs: (id: string) => ipcRenderer.invoke('server:logs:clear', id),

  // Listeners
  onCreationProgress: (callback: (data: { step: string; progress: number; message: string }) => void) => {
    const handler = (_event: any, data: { step: string; progress: number; message: string }) => callback(data);
    ipcRenderer.on('server:creation:progress', handler);
    return () => ipcRenderer.removeListener('server:creation:progress', handler);
  },
  onTerminalOutput: (callback: (id: string, output: string) => void) => {
    const handler = (_event: any, id: string, output: string) => callback(id, output);
    ipcRenderer.on('terminal:output', handler);
    return () => ipcRenderer.removeListener('terminal:output', handler);
  },
  onServerStatusChanged: (callback: (id: string, status: string, data?: any) => void) => {
    const handler = (_event: any, id: string, status: string, data?: any) => callback(id, status, data);
    ipcRenderer.on('server:status:changed', handler);
    return () => ipcRenderer.removeListener('server:status:changed', handler);
  },

  // Port checking
  checkPort: (port: number) => ipcRenderer.invoke('port:check', port),

  // Versions
  getVersions: (loader: string) => ipcRenderer.invoke('versions:get', loader),
  neoToMc: (neoVersion: string) => ipcRenderer.invoke('versions:neo-to-mc', neoVersion),

  // System
  getSystemRam: () => ipcRenderer.invoke('system:ram'),

  // Modrinth
  modrinthSearch: (query: string, loaders: string[], versions: string[], limit?: number) =>
    ipcRenderer.invoke('modrinth:search', query, loaders, versions, limit),
  modrinthGetVersions: (projectId: string) => ipcRenderer.invoke('modrinth:get-versions', projectId),
  modrinthDownload: (projectId: string, versionId: string, serverPath: string) =>
    ipcRenderer.invoke('modrinth:download', projectId, versionId, serverPath),

  // Tunneling
  startTunnel: (serverId: string, port: number) => ipcRenderer.invoke('tunnel:start', serverId, port),
  stopTunnel: (serverId: string) => ipcRenderer.invoke('tunnel:stop', serverId),
  getTunnelStatus: (serverId: string) => ipcRenderer.invoke('tunnel:status', serverId),
  getPublicIp: () => ipcRenderer.invoke('tunnel:public-ip'),
  getLocalIp: () => ipcRenderer.invoke('tunnel:local-ip'),

  // File management
  listFiles: (serverId: string, dirPath?: string) => ipcRenderer.invoke('files:list', serverId, dirPath),
  readFile: (serverId: string, filePath: string) => ipcRenderer.invoke('files:read', serverId, filePath),
  writeFile: (serverId: string, filePath: string, content: string) => ipcRenderer.invoke('files:write', serverId, filePath, content),
  deleteFile: (serverId: string, filePath: string) => ipcRenderer.invoke('files:delete', serverId, filePath),

  // JVM
  getJVMArgs: (serverId: string) => ipcRenderer.invoke('server:jvm:get', serverId),
  setJVMArgs: (serverId: string, args: string) => ipcRenderer.invoke('server:jvm:set', serverId, args),

  // Server config
  getServerConfig: (serverId: string) => ipcRenderer.invoke('server:config:get', serverId),
  setServerConfig: (serverId: string, config: any) => ipcRenderer.invoke('server:config:set', serverId, config),

  // Dialog
  openFileDialog: (options: any) => ipcRenderer.invoke('dialog:openFile', options),
  saveFileDialog: (options: any) => ipcRenderer.invoke('dialog:saveFile', options),
});
