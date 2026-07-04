import { contextBridge, ipcRenderer, IpcRendererEvent } from 'electron';

contextBridge.exposeInMainWorld('electronAPI', {
  getServers: () => ipcRenderer.invoke('servers:list'),
  getServer: (id: string) => ipcRenderer.invoke('servers:get', id),
  createServer: (config: Record<string, unknown>) => ipcRenderer.invoke('servers:create', config),
  deleteServer: (id: string) => ipcRenderer.invoke('servers:delete', id),
  startServer: (id: string) => ipcRenderer.invoke('server:start', id),
  stopServer: (id: string) => ipcRenderer.invoke('server:stop', id),
  restartServer: (id: string) => ipcRenderer.invoke('server:restart', id),
  sendCommand: (id: string, command: string) => ipcRenderer.invoke('server:command', id, command),
  getServerStatus: (id: string) => ipcRenderer.invoke('server:status', id),
  getTerminalOutput: (id: string) => ipcRenderer.invoke('server:terminal:get', id),
  listenToTerminal: (id: string) => ipcRenderer.invoke('server:terminal:listen', id),
  unlistenTerminal: (id: string) => ipcRenderer.invoke('server:terminal:unlisten', id),
  getLogs: (id: string) => ipcRenderer.invoke('server:logs:get', id),
  clearLogs: (id: string) => ipcRenderer.invoke('server:logs:clear', id),

  onCreationProgress: (callback: (data: { step: string; progress: number; message: string }) => void) => {
    const handler = (_event: IpcRendererEvent, data: { step: string; progress: number; message: string }) => callback(data);
    ipcRenderer.on('server:creation:progress', handler);
    return () => ipcRenderer.removeListener('server:creation:progress', handler);
  },
  onTerminalOutput: (callback: (id: string, output: string) => void) => {
    const handler = (_event: IpcRendererEvent, id: string, output: string) => callback(id, output);
    ipcRenderer.on('terminal:output', handler);
    return () => ipcRenderer.removeListener('terminal:output', handler);
  },
  onServerStatusChanged: (callback: (id: string, status: string, data?: Record<string, unknown>) => void) => {
    const handler = (_event: IpcRendererEvent, id: string, status: string, data?: Record<string, unknown>) => callback(id, status, data);
    ipcRenderer.on('server:status:changed', handler);
    return () => ipcRenderer.removeListener('server:status:changed', handler);
  },

  getNewFeatures: () => ipcRenderer.invoke('features:new'),
  acknowledgeFeature: (featureId: string) => ipcRenderer.invoke('features:acknowledge', featureId),
  getFeatureConfig: (key: string, defaultValue?: string | number | boolean) => ipcRenderer.invoke('features:get-config', key, defaultValue),
  setFeatureConfig: (key: string, value: string | number | boolean) => ipcRenderer.invoke('features:set-config', key, value),
  getAllFeatureConfig: () => ipcRenderer.invoke('features:get-all-config'),
  getNextFeature: () => ipcRenderer.invoke('features:next'),

  checkPort: (port: number, excludeServerId?: string) => ipcRenderer.invoke('port:check', port, excludeServerId),
  getVersions: (loader: string) => ipcRenderer.invoke('versions:get', loader),
  neoToMc: (neoVersion: string) => ipcRenderer.invoke('versions:neo-to-mc', neoVersion),
  getSystemRam: () => ipcRenderer.invoke('system:ram'),

  modrinthSearch: (query: string, loaders: string[], versions: string[], limit?: number) =>
    ipcRenderer.invoke('modrinth:search', query, loaders, versions, limit),
  modrinthGetVersions: (projectId: string) => ipcRenderer.invoke('modrinth:get-versions', projectId),
  modrinthDownload: (projectId: string, versionId: string, serverPath: string) =>
    ipcRenderer.invoke('modrinth:download', projectId, versionId, serverPath),

  startTunnel: (serverId: string, port: number) => ipcRenderer.invoke('tunnel:start', serverId, port),
  stopTunnel: (serverId: string) => ipcRenderer.invoke('tunnel:stop', serverId),
  getTunnelStatus: (serverId: string) => ipcRenderer.invoke('tunnel:status', serverId),
  getPublicIp: () => ipcRenderer.invoke('tunnel:public-ip'),
  getLocalIp: () => ipcRenderer.invoke('tunnel:local-ip'),
  onTunnelReady: (callback: (data: { serverId: string; url: string }) => void) => {
    const handler = (_event: IpcRendererEvent, data: { serverId: string; url: string }) => callback(data);
    ipcRenderer.on('server:tunnel:ready', handler);
    return () => ipcRenderer.removeListener('server:tunnel:ready', handler);
  },
  onTunnelStarting: (callback: (data: { serverId: string; port: number }) => void) => {
    const handler = (_event: IpcRendererEvent, data: { serverId: string; port: number }) => callback(data);
    ipcRenderer.on('server:tunnel:starting', handler);
    return () => ipcRenderer.removeListener('server:tunnel:starting', handler);
  },

  getAutoStart: () => ipcRenderer.invoke('autostart:get'),
  setAutoStart: (settings: { autoStart: boolean; autoStartServers: string[] }) => ipcRenderer.invoke('autostart:set', settings),

  listFiles: (serverId: string, dirPath?: string) => ipcRenderer.invoke('files:list', serverId, dirPath),
  readFile: (serverId: string, filePath: string) => ipcRenderer.invoke('files:read', serverId, filePath),
  writeFile: (serverId: string, filePath: string, content: string) => ipcRenderer.invoke('files:write', serverId, filePath, content),
  deleteFile: (serverId: string, filePath: string) => ipcRenderer.invoke('files:delete', serverId, filePath),

  getJVMArgs: (serverId: string) => ipcRenderer.invoke('server:jvm:get', serverId),
  setJVMArgs: (serverId: string, args: string) => ipcRenderer.invoke('server:jvm:set', serverId, args),
  getServerConfig: (serverId: string) => ipcRenderer.invoke('server:config:get', serverId),
  setServerConfig: (serverId: string, config: Record<string, string>) => ipcRenderer.invoke('server:config:set', serverId, config),

  checkForUpdates: () => ipcRenderer.invoke('update:check'),
  downloadUpdate: () => ipcRenderer.invoke('update:download'),
  installUpdate: () => ipcRenderer.invoke('update:install'),
  getUpdateState: () => ipcRenderer.invoke('update:get-state'),
  onUpdateState: (callback: (state: { status: string; version?: string; progress?: number; error?: string }) => void) => {
    const handler = (_event: IpcRendererEvent, state: { status: string; version?: string; progress?: number; error?: string }) =>
      callback(state);
    ipcRenderer.on('update:state', handler);
    return () => ipcRenderer.removeListener('update:state', handler);
  },

  openFileDialog: (options: Electron.OpenDialogOptions) => ipcRenderer.invoke('dialog:openFile', options),
  saveFileDialog: (options: Electron.SaveDialogOptions) => ipcRenderer.invoke('dialog:saveFile', options),
});
