export interface ServerConfig {
  id: string;
  name: string;
  loader: 'vanilla' | 'forge' | 'fabric' | 'neoforge' | 'paper' | 'spigot' | 'purpur';
  version: string;
  port: number;
  maxPlayers: number;
  motd: string;
  gamemode: 'survival' | 'creative' | 'adventure' | 'spectator';
  difficulty: 'peaceful' | 'easy' | 'normal' | 'hard';
  ram: number;
  icon?: string;
  tunnelEnabled: boolean;
  jvmArgs?: string;
  autoRestart: boolean;
}

export interface ServerStatus {
  status: 'stopped' | 'starting' | 'running' | 'stopping' | 'crashed';
  running: boolean;
  pid: number | null;
}

export interface SystemRam {
  totalRam: number;
  freeRam: number;
  maxServerRam: number;
  recommendedRam: number;
}

export interface PortCheck {
  inUse: boolean;
  reason?: string;
}

export interface ModrinthProject {
  project_id: string;
  project_type: string;
  slug: string;
  title: string;
  description: string;
  icon_url: string | null;
  downloads: number;
  follows: number;
  date_modified: string;
  latest_version: string;
  categories: string[];
  versions: string[];
}

export interface ModrinthVersion {
  id: string;
  project_id: string;
  name: string;
  version_number: string;
  date_published: string;
  downloads: number;
  files: Array<{
    url: string;
    filename: string;
    primary: boolean;
    size: number;
  }>;
  loaders: string[];
  game_versions: string[];
}

export interface TunnelStatus {
  status: string;
  url: string | null;
  error?: string;
}

export interface FileEntry {
  name: string;
  path: string;
  isDirectory: boolean;
  size: number;
  modified: Date;
}

export type ConfigValue = string | number | boolean;

export interface FeatureDef {
  id: string;
  version: string;
  title: string;
  description: string;
  type: 'info' | 'config';
  configKey?: string;
  defaultValue?: ConfigValue;
  options?: { label: string; value: ConfigValue }[];
}

export interface AutoStartSettings {
  autoStart: boolean;
  autoStartServers: string[];
  loginItemEnabled: boolean;
}

export interface UpdateState {
  status: 'idle' | 'checking' | 'available' | 'downloading' | 'downloaded' | 'error';
  version?: string;
  progress?: number;
  error?: string;
}

export interface CreateServerResult {
  success: boolean;
  server?: ServerConfig;
  error?: string;
}

export interface VersionResult {
  success: boolean;
  versions?: Array<{ version: string; stable: boolean }>;
  error?: string;
}

export interface TunnelResult {
  success: boolean;
  url?: string;
  error?: string;
}

export interface DialogOptions {
  title?: string;
  defaultPath?: string;
  filters?: Array<{ name: string; extensions: string[] }>;
  properties?: Array<'openFile' | 'openDirectory' | 'multiSelections' | 'showHiddenFiles'>;
}

export interface ElectronAPI {
  getServers: () => Promise<ServerConfig[]>;
  getServer: (id: string) => Promise<ServerConfig | null>;
  createServer: (config: Omit<ServerConfig, 'id'>) => Promise<CreateServerResult>;
  deleteServer: (id: string) => Promise<{ success: boolean }>;
  startServer: (id: string) => Promise<{ success: boolean; error?: string }>;
  stopServer: (id: string) => Promise<{ success: boolean }>;
  restartServer: (id: string) => Promise<{ success: boolean; error?: string }>;
  sendCommand: (id: string, command: string) => Promise<{ success: boolean }>;
  getServerStatus: (id: string) => Promise<ServerStatus>;
  getTerminalOutput: (id: string) => Promise<string[]>;
  listenToTerminal: (id: string) => Promise<{ success: boolean }>;
  unlistenTerminal: (id: string) => Promise<{ success: boolean }>;
  getLogs: (id: string) => Promise<string[]>;
  clearLogs: (id: string) => Promise<{ success: boolean }>;
  onCreationProgress: (callback: (data: { step: string; progress: number; message: string }) => void) => () => void;
  onTerminalOutput: (callback: (id: string, output: string) => void) => () => void;
  onServerStatusChanged: (callback: (id: string, status: string, data?: Record<string, unknown>) => void) => () => void;
  checkPort: (port: number, excludeServerId?: string) => Promise<PortCheck>;
  getVersions: (loader: string) => Promise<VersionResult>;
  neoToMc: (neoVersion: string) => Promise<{ mcVersion: string }>;
  getSystemRam: () => Promise<SystemRam>;
  modrinthSearch: (
    query: string,
    loaders: string[],
    versions: string[],
    limit?: number,
  ) => Promise<{ success: boolean; results?: ModrinthProject[]; error?: string }>;
  modrinthGetVersions: (projectId: string) => Promise<{ success: boolean; versions?: ModrinthVersion[]; error?: string }>;
  modrinthDownload: (projectId: string, versionId: string, serverPath: string) => Promise<{ success: boolean; error?: string }>;
  startTunnel: (serverId: string, port: number) => Promise<TunnelResult>;
  stopTunnel: (serverId: string) => Promise<void>;
  getTunnelStatus: (serverId: string) => Promise<TunnelStatus>;
  getPublicIp: () => Promise<string | null>;
  getLocalIp: () => Promise<string | null>;
  onTunnelReady: (callback: (data: { serverId: string; url: string }) => void) => () => void;
  onTunnelStarting: (callback: (data: { serverId: string; port: number }) => void) => () => void;
  getAutoStart: () => Promise<AutoStartSettings>;
  setAutoStart: (settings: { autoStart: boolean; autoStartServers: string[] }) => Promise<{ success: boolean }>;
  listFiles: (serverId: string, dirPath?: string) => Promise<FileEntry[]>;
  readFile: (serverId: string, filePath: string) => Promise<{ content: string; isBinary: boolean }>;
  writeFile: (serverId: string, filePath: string, content: string) => Promise<{ success: boolean }>;
  deleteFile: (serverId: string, filePath: string) => Promise<{ success: boolean }>;
  getJVMArgs: (serverId: string) => Promise<string>;
  setJVMArgs: (serverId: string, args: string) => Promise<{ success: boolean }>;
  getServerConfig: (serverId: string) => Promise<Record<string, string> | null>;
  setServerConfig: (serverId: string, config: Record<string, string>) => Promise<{ success: boolean }>;
  checkForUpdates: () => Promise<{ success: boolean }>;
  downloadUpdate: () => Promise<{ success: boolean }>;
  installUpdate: () => Promise<{ success: boolean }>;
  getUpdateState: () => Promise<UpdateState>;
  onUpdateState: (callback: (state: UpdateState) => void) => () => void;
  openFileDialog: (options: DialogOptions) => Promise<{ canceled: boolean; filePaths: string[] }>;
  saveFileDialog: (options: DialogOptions) => Promise<{ canceled: boolean; filePath?: string }>;
  getNewFeatures: () => Promise<{ features: FeatureDef[] }>;
  acknowledgeFeature: (featureId: string) => Promise<{ success: boolean }>;
  getFeatureConfig: <T = ConfigValue>(key: string, defaultValue?: T) => Promise<{ value: T }>;
  setFeatureConfig: (key: string, value: ConfigValue) => Promise<{ success: boolean }>;
  getAllFeatureConfig: () => Promise<{ config: Record<string, ConfigValue> }>;
  getNextFeature: () => Promise<{ feature: FeatureDef | null }>;
}

declare global {
  interface Window {
    electronAPI: ElectronAPI;
  }
}
