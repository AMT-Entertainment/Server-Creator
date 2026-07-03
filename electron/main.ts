import { app, BrowserWindow, ipcMain, dialog, Notification } from 'electron';
import { autoUpdater } from 'electron-updater';
import * as path from 'path';
import * as fs from 'fs';
import * as os from 'os';
import { ServerManager } from './services/server-manager';
import { ModrinthAPI } from './services/modrinth-api';
import { PortChecker } from './services/port-checker';
import { TunnelingService, setMainWindowCallback } from './services/tunneling';
import { FileManager } from './services/file-manager';
import { VersionFetcher } from './services/version-fetcher';

let mainWindow: BrowserWindow | null = null;
const serverManager = new ServerManager();
const modrinthAPI = new ModrinthAPI();
const portChecker = new PortChecker();
const tunnelingService = new TunnelingService();
const fileManager = new FileManager();
const versionFetcher = new VersionFetcher();

const CONFIG_PATH = path.join(os.homedir(), '.server-creator', 'config.json');

function loadConfig(): { autoStart: boolean; autoStartServers: string[] } {
  try {
    if (fs.existsSync(CONFIG_PATH)) {
      return JSON.parse(fs.readFileSync(CONFIG_PATH, 'utf-8'));
    }
  } catch {}
  return { autoStart: false, autoStartServers: [] };
}

function saveConfig(config: { autoStart: boolean; autoStartServers: string[] }) {
  try {
    if (!fs.existsSync(path.dirname(CONFIG_PATH))) {
      fs.mkdirSync(path.dirname(CONFIG_PATH), { recursive: true });
    }
    fs.writeFileSync(CONFIG_PATH, JSON.stringify(config, null, 2));
  } catch {}
}

function showNotification(title: string, body: string) {
  if (Notification.isSupported()) {
    const notif = new Notification({ title, body });
    notif.on('click', () => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.show();
        mainWindow.focus();
      }
    });
    notif.show();
  }
}

function createWindow() {
  mainWindow = new BrowserWindow({
    width: 1280,
    height: 800,
    minWidth: 960,
    minHeight: 600,
    backgroundColor: '#0f0f0f',
    titleBarStyle: 'hiddenInset',
    frame: process.platform === 'darwin' ? false : true,
    webPreferences: {
      preload: path.join(__dirname, 'preload.js'),
      contextIsolation: true,
      nodeIntegration: false,
    },
  });

  mainWindow.loadFile(path.join(__dirname, '../renderer/index.html'));

  if (process.argv.includes('--dev')) {
    mainWindow.webContents.openDevTools();
  }

  mainWindow.on('closed', () => {
    mainWindow = null;
  });
}

let updateCheckInterval: NodeJS.Timeout | null = null;
let updateState: {
  status: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error';
  version?: string;
  progress?: number;
  error?: string;
} = { status: 'idle' };

function sendUpdateState() {
  if (mainWindow && !mainWindow.isDestroyed()) {
    mainWindow.webContents.send('update:state', updateState);
  }
}

function setupAutoUpdater() {
  autoUpdater.logger = console;
  autoUpdater.autoDownload = false;
  autoUpdater.autoInstallOnAppQuit = true;
  autoUpdater.allowPrerelease = false;

  autoUpdater.on('checking-for-update', () => {
    updateState = { status: 'checking' };
    sendUpdateState();
  });

  autoUpdater.on('update-available', (info) => {
    updateState = { status: 'available', version: info.version };
    sendUpdateState();
  });

  autoUpdater.on('update-not-available', () => {
    updateState = { status: 'idle' };
    sendUpdateState();
  });

  autoUpdater.on('download-progress', (progress) => {
    updateState = { ...updateState, status: 'downloading', progress: Math.round(progress.percent) };
    sendUpdateState();
  });

  autoUpdater.on('update-downloaded', (info) => {
    updateState = { status: 'downloaded', version: info.version };
    sendUpdateState();
  });

  autoUpdater.on('error', (err) => {
    const msg = (err.message || '').toLowerCase();
    if (msg.includes('404') || msg.includes('not found') || msg.includes('could not find') || msg.includes('network') || msg.includes('econnrefused')) {
      updateState = { status: 'idle' };
    } else {
      updateState = { status: 'error', error: err.message };
    }
    sendUpdateState();
  });
}

function checkForUpdates() {
  if (updateState.status === 'checking' || updateState.status === 'downloading' || updateState.status === 'downloaded') return;
  updateState = { status: 'checking' };
  sendUpdateState();
  autoUpdater.checkForUpdates().catch((err) => {
    const msg = (err.message || '').toLowerCase();
    if (msg.includes('404') || msg.includes('not found') || msg.includes('could not find') || msg.includes('network') || msg.includes('econnrefused')) {
      updateState = { status: 'idle' };
    } else {
      updateState = { status: 'error', error: err.message };
    }
    sendUpdateState();
  });
}

function autoStartServers() {
  const config = loadConfig();
  if (!config.autoStart) return;

  if (config.autoStartServers.length > 0) {
    showNotification('Server Creator', `Auto-starting ${config.autoStartServers.length} server(s)...`);
  }

  for (const serverId of config.autoStartServers) {
    const server = serverManager.getServer(serverId);
    if (server) {
      setTimeout(async () => {
        try {
          await serverManager.startServer(serverId);
          showNotification('Server Started', `${server.name} has started automatically`);
          const port = server.port;
          if (port && server.tunnelEnabled) {
            tunnelingService.startTunnel(serverId, port).then(url => {
              if (url && mainWindow && !mainWindow.isDestroyed()) {
                mainWindow.webContents.send('server:tunnel:ready', { serverId, url });
              }
            }).catch(() => {});
          }
        } catch (err: any) {
          showNotification('Server Failed', `${server.name} failed to auto-start: ${err.message}`);
        }
      }, 3000);
    }
  }
}

app.whenReady().then(() => {
  createWindow();
  setupAutoUpdater();

  setMainWindowCallback((channel, data) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send(channel, data);
    }
  });

  checkForUpdates();
  updateCheckInterval = setInterval(checkForUpdates, 3600000);

  autoStartServers();

  app.on('activate', () => {
    if (BrowserWindow.getAllWindows().length === 0) {
      createWindow();
    }
  });
});

app.on('window-all-closed', () => {
  tunnelingService.stopAll();
  serverManager.stopAllServers();
  if (process.platform !== 'darwin') {
    app.quit();
  }
});

app.on('before-quit', () => {
  tunnelingService.stopAll();
  serverManager.stopAllServers();
});

// === IPC Handlers ===

// Auto-start
ipcMain.handle('autostart:get', () => {
  const config = loadConfig();
  return {
    autoStart: config.autoStart,
    autoStartServers: config.autoStartServers,
    loginItemEnabled: app.getLoginItemSettings().openAtLogin,
  };
});

ipcMain.handle('autostart:set', (_event, settings: { autoStart: boolean; autoStartServers: string[] }) => {
  const config = loadConfig();
  config.autoStart = settings.autoStart;
  config.autoStartServers = settings.autoStartServers;
  saveConfig(config);
  app.setLoginItemSettings({ openAtLogin: settings.autoStart });
  return { success: true };
});

// Playit.gg tunneling
ipcMain.handle('tunnel:playit:ensure', async () => {
  const installed = await tunnelingService.ensurePlayitAgent();
  return { success: installed };
});

ipcMain.handle('tunnel:playit:claim-url', () => {
  return { url: tunnelingService.getPlayitClaimUrl() };
});

// Server list
ipcMain.handle('servers:list', () => {
  return serverManager.listServers();
});

ipcMain.handle('servers:get', (_event, id: string) => {
  return serverManager.getServer(id);
});

ipcMain.handle('servers:create', async (event, config: any) => {
  try {
    serverManager.onCreationProgress = (step, progress, message) => {
      if (mainWindow && !mainWindow.isDestroyed()) {
        mainWindow.webContents.send('server:creation:progress', { step, progress, message });
      }
    };
    const server = await serverManager.createServer(config);
    serverManager.onCreationProgress = null;
    return { success: true, server };
  } catch (err: any) {
    serverManager.onCreationProgress = null;
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('server:creation:progress', { step: 'error', progress: 0, message: err.message });
    }
    return { success: false, error: err.message };
  }
});

ipcMain.handle('servers:delete', (_event, id: string) => {
  serverManager.deleteServer(id);
  return { success: true };
});

// Server lifecycle
ipcMain.handle('server:start', async (_event, id: string) => {
  try {
    const port = await serverManager.getServerPort(id);
    if (port) {
      const inUse = await portChecker.isPortInUse(port);
      if (inUse) {
        return { success: false, error: `Port ${port} is already in use` };
      }
    }
    const server = serverManager.getServer(id);
    await serverManager.startServer(id);
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('server:tunnel:starting', { serverId: id, port });
    }
    if (port) {
      tunnelingService.startTunnel(id, port).then(url => {
        if (url && mainWindow && !mainWindow.isDestroyed()) {
          mainWindow.webContents.send('server:tunnel:ready', { serverId: id, url });
        }
      }).catch(() => {});
    }
    showNotification(`Server Started`, `${server?.name || id} is now running on port ${port}`);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('tunnel:public-ip', async () => {
  return await tunnelingService.getPublicIp();
});

ipcMain.handle('tunnel:local-ip', () => {
  return tunnelingService.getLocalIp();
});

ipcMain.handle('server:stop', async (_event, id: string) => {
  try {
    await serverManager.stopServer(id);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('server:restart', async (_event, id: string) => {
  try {
    await serverManager.restartServer(id);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('server:command', (_event, id: string, command: string) => {
  serverManager.sendCommand(id, command);
  return { success: true };
});

ipcMain.handle('server:terminal:get', (_event, id: string) => {
  return serverManager.getTerminalOutput(id);
});

ipcMain.handle('server:logs:get', (_event, id: string) => {
  return serverManager.getLogs(id);
});

ipcMain.handle('server:logs:clear', (_event, id: string) => {
  serverManager.clearLogs(id);
  return { success: true };
});

ipcMain.handle('server:status', (_event, id: string) => {
  return serverManager.getServerStatus(id);
});

// Terminal output listener
const terminalUnlisteners: Map<string, () => void> = new Map();

ipcMain.handle('server:terminal:listen', (event, id: string) => {
  const existing = terminalUnlisteners.get(id);
  if (existing) existing();
  const unsub = serverManager.onTerminalOutput(id, (output: string) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('terminal:output', id, output);
    }
  });
  terminalUnlisteners.set(id, unsub);
  return { success: true };
});

ipcMain.handle('server:terminal:unlisten', (event, id: string) => {
  const existing = terminalUnlisteners.get(id);
  if (existing) {
    existing();
    terminalUnlisteners.delete(id);
  }
  return { success: true };
});

ipcMain.handle('server:status:listen', (event, id: string) => {
  serverManager.onStatusChange(id, (status: string, data?: any) => {
    if (mainWindow && !mainWindow.isDestroyed()) {
      mainWindow.webContents.send('server:status:changed', id, status, data);
    }
  });
  return { success: true };
});

// Port checking
ipcMain.handle('port:check', async (_event, port: number, excludeServerId?: string) => {
  const osInUse = await portChecker.isPortInUse(port);
  if (osInUse) return { inUse: true, reason: 'Port is already in use by another application' };

  const otherServers = serverManager.listServers().filter(s => s.id !== excludeServerId && s.port === port);
  if (otherServers.length > 0) {
    return { inUse: true, reason: `Port ${port} is already used by server "${otherServers[0].name}"` };
  }

  return { inUse: false };
});

ipcMain.handle('system:ram', () => {
  const totalRam = Math.round(os.totalmem() / (1024 * 1024 * 1024));
  const freeRam = Math.round(os.freemem() / (1024 * 1024 * 1024));
  const maxServerRam = Math.max(0, totalRam - 4);
  return {
    totalRam,
    freeRam,
    maxServerRam,
    recommendedRam: Math.min(Math.max(2, Math.floor(freeRam * 0.6)), maxServerRam),
  };
});

// Versions
ipcMain.handle('versions:get', async (_event, loader: string) => {
  try {
    const versions = await versionFetcher.getVersions(loader);
    return { success: true, versions };
  } catch (err: any) {
    return { success: false, error: err.message, versions: [] };
  }
});

ipcMain.handle('versions:neo-to-mc', (_event, neoVersion: string) => {
  return { mcVersion: versionFetcher.neoToMc(neoVersion) };
});

// Modrinth API
ipcMain.handle('modrinth:search', async (_event, query: string, loaders: string[], versions: string[], limit?: number) => {
  try {
    const results = await modrinthAPI.searchProjects(query, loaders, versions, limit);
    return { success: true, results };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('modrinth:get-versions', async (_event, projectId: string) => {
  try {
    const versions = await modrinthAPI.getProjectVersions(projectId);
    return { success: true, versions };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('modrinth:download', async (_event, projectId: string, versionId: string, serverPath: string) => {
  try {
    await modrinthAPI.downloadVersion(projectId, versionId, serverPath);
    return { success: true };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

// Tunneling
ipcMain.handle('tunnel:start', async (_event, serverId: string, port: number) => {
  try {
    const url = await tunnelingService.startTunnel(serverId, port);
    return { success: true, url };
  } catch (err: any) {
    return { success: false, error: err.message };
  }
});

ipcMain.handle('tunnel:stop', (_event, serverId: string) => {
  tunnelingService.stopTunnel(serverId);
  return { success: true };
});

ipcMain.handle('tunnel:status', (_event, serverId: string) => {
  return tunnelingService.getTunnelStatus(serverId);
});

// File management
ipcMain.handle('files:list', (_event, serverId: string, dirPath?: string) => {
  return fileManager.listFiles(serverId, dirPath);
});

ipcMain.handle('files:read', (_event, serverId: string, filePath: string) => {
  return fileManager.readFile(serverId, filePath);
});

ipcMain.handle('files:write', (_event, serverId: string, filePath: string, content: string) => {
  fileManager.writeFile(serverId, filePath, content);
  return { success: true };
});

ipcMain.handle('files:delete', (_event, serverId: string, filePath: string) => {
  fileManager.deleteFile(serverId, filePath);
  return { success: true };
});

// JVM args
ipcMain.handle('server:jvm:get', (_event, serverId: string) => {
  return serverManager.getJVMArgs(serverId);
});

ipcMain.handle('server:jvm:set', (_event, serverId: string, args: string) => {
  serverManager.setJVMArgs(serverId, args);
  return { success: true };
});

// Server config (server.properties)
ipcMain.handle('server:config:get', (_event, serverId: string) => {
  return serverManager.getServerConfig(serverId);
});

ipcMain.handle('server:config:set', (_event, serverId: string, config: any) => {
  serverManager.setServerConfig(serverId, config);
  return { success: true };
});

// Auto-update
ipcMain.handle('update:check', () => {
  checkForUpdates();
  return { success: true };
});

ipcMain.handle('update:get-state', () => {
  return updateState;
});

ipcMain.handle('update:download', () => {
  if (updateState.status === 'available' && updateState.version) {
    updateState = { status: 'downloading', version: updateState.version, progress: 0 };
    sendUpdateState();
    autoUpdater.downloadUpdate().then(() => {
      updateState = { status: 'downloaded', version: updateState.version };
      sendUpdateState();
    }).catch((err) => {
      updateState = { status: 'error', version: updateState.version, error: err.message };
      sendUpdateState();
    });
  }
  return { success: true };
});

ipcMain.handle('update:install', () => {
  autoUpdater.quitAndInstall();
  return { success: true };
});

// Dialog
ipcMain.handle('dialog:openFile', async (_event, options: any) => {
  if (!mainWindow) return { canceled: true };
  const result = await dialog.showOpenDialog(mainWindow, options);
  return result;
});

ipcMain.handle('dialog:saveFile', async (_event, options: any) => {
  if (!mainWindow) return { canceled: true };
  const result = await dialog.showSaveDialog(mainWindow, options);
  return result;
});
