import * as fs from 'fs';
import * as path from 'path';
import { spawn, ChildProcess, execSync } from 'child_process';
import * as http from 'http';
import * as https from 'https';
import * as os from 'os';
import { VersionFetcher } from './version-fetcher';

interface ServerConfig {
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

interface ServerInstance {
  config: ServerConfig;
  process: ChildProcess | null;
  status: 'stopped' | 'starting' | 'running' | 'stopping' | 'crashed';
  terminalOutput: string[];
  logs: string[];
  statusListeners: ((status: string, data?: any) => void)[];
  terminalListeners: ((output: string) => void)[];
  safeStopRequested: boolean;
}

const SERVERS_DIR = path.join(os.homedir(), '.server-creator', 'servers');

export type ProgressCallback = (step: string, progress: number, message: string) => void;

export class ServerManager {
  private servers: Map<string, ServerInstance> = new Map();
  private versionFetcher: VersionFetcher;
  public onCreationProgress: ProgressCallback | null = null;

  constructor() {
    this.versionFetcher = new VersionFetcher();
    this.ensureDirectories();
    this.loadServers();
  }

  private ensureDirectories() {
    if (!fs.existsSync(SERVERS_DIR)) {
      fs.mkdirSync(SERVERS_DIR, { recursive: true });
    }
  }

  private loadServers() {
    if (!fs.existsSync(SERVERS_DIR)) return;
    const dirs = fs.readdirSync(SERVERS_DIR);
    for (const dir of dirs) {
      const configPath = path.join(SERVERS_DIR, dir, 'server.json');
      if (fs.existsSync(configPath)) {
        try {
          const config = JSON.parse(fs.readFileSync(configPath, 'utf-8'));
          this.servers.set(config.id, {
            config,
            process: null,
            status: 'stopped',
            terminalOutput: [],
            logs: [],
            statusListeners: [],
            terminalListeners: [],
            safeStopRequested: false,
          });
        } catch (e) {
          console.error(`Failed to load server ${dir}:`, e);
        }
      }
    }
  }

  listServers(): ServerConfig[] {
    return Array.from(this.servers.values()).map(s => s.config);
  }

  getServer(id: string): ServerConfig | null {
    const instance = this.servers.get(id);
    return instance ? instance.config : null;
  }

  async createServer(config: Omit<ServerConfig, 'id'>): Promise<ServerConfig> {
    const id = `${config.name.toLowerCase().replace(/[^a-z0-9]/g, '-')}-${Date.now()}`;
    const fullConfig: ServerConfig = { ...config, id };
    const serverDir = path.join(SERVERS_DIR, id);

    const emit = (step: string, msg: string) => {
      if (this.onCreationProgress) this.onCreationProgress(step, 0, msg);
    };

    emit('dirs', 'Creating server directories...');
    if (!fs.existsSync(serverDir)) {
      fs.mkdirSync(serverDir, { recursive: true });
    }

    emit('download', `Downloading ${config.loader} ${config.version} server jar...`);
    await this.downloadServerJar(fullConfig);

    emit('config', 'Configuring server.properties...');
    this.writeServerProperties(serverDir, fullConfig);

    emit('scripts', 'Writing startup scripts...');
    this.writeStartScript(serverDir, fullConfig);

    emit('eula', 'Accepting Minecraft EULA...');
    fs.writeFileSync(path.join(serverDir, 'eula.txt'), 'eula=true\n');

    emit('save', 'Saving server configuration...');
    fs.writeFileSync(path.join(serverDir, 'server.json'), JSON.stringify(fullConfig, null, 2));

    this.servers.set(id, {
      config: fullConfig,
      process: null,
      status: 'stopped',
      terminalOutput: [],
      logs: [],
      statusListeners: [],
      terminalListeners: [],
      safeStopRequested: false,
    });

    emit('done', 'Server created successfully!');
    return fullConfig;
  }

  deleteServer(id: string) {
    const instance = this.servers.get(id);
    if (instance && instance.process) {
      this.stopServer(id);
    }
    const serverDir = path.join(SERVERS_DIR, id);
    if (fs.existsSync(serverDir)) {
      fs.rmSync(serverDir, { recursive: true });
    }
    this.servers.delete(id);
  }

  async startServer(id: string): Promise<void> {
    const instance = this.servers.get(id);
    if (!instance) throw new Error('Server not found');
    if (instance.process) throw new Error('Server is already running');

    instance.status = 'starting';
    this.notifyStatus(id, 'starting');

    const serverDir = path.join(SERVERS_DIR, id);
    const jarFile = this.findJarFile(serverDir);

    if (!jarFile) {
      instance.status = 'crashed';
      this.notifyStatus(id, 'crashed');
      throw new Error('Server jar file not found');
    }

    const jvmArgs = instance.config.jvmArgs || `-Xmx${instance.config.ram}G -Xms${Math.min(1, instance.config.ram)}G`;
    const javaCmd = `java ${jvmArgs} -jar "${jarFile}" nogui`;

    const child = spawn(javaCmd, [], {
      cwd: serverDir,
      shell: true,
      stdio: ['pipe', 'pipe', 'pipe'],
    });

    instance.process = child;
    this.appendTerminal(id, `[SERVER] Starting server with ${instance.config.ram}GB RAM...\n`);
    this.appendLog(id, `Server starting: ${instance.config.name}`);

    child.stdout?.on('data', (data: Buffer) => {
      const output = data.toString();
      this.appendTerminal(id, output);
      this.appendLog(id, output);

      if (output.includes('Done') && (output.includes('For help') || output.includes('!'))) {
        instance.status = 'running';
        this.notifyStatus(id, 'running');
        this.appendLog(id, 'Server is now online!');
      }
    });

    child.stderr?.on('data', (data: Buffer) => {
      const output = data.toString();
      this.appendTerminal(id, `[ERROR] ${output}`);
      this.appendLog(id, `[ERROR] ${output}`);
    });

    child.on('exit', (code) => {
      instance.process = null;
      if (instance.safeStopRequested) {
        instance.status = 'stopped';
        this.notifyStatus(id, 'stopped');
        instance.safeStopRequested = false;
      } else if (code !== 0) {
        instance.status = 'crashed';
        this.notifyStatus(id, 'crashed', { exitCode: code });
        this.appendLog(id, `Server crashed with exit code ${code}`);

        if (instance.config.autoRestart && instance.status === 'crashed') {
          setTimeout(() => this.startServer(id), 5000);
        }
      } else {
        instance.status = 'stopped';
        this.notifyStatus(id, 'stopped');
      }
    });

    child.on('error', (err) => {
      instance.process = null;
      instance.status = 'crashed';
      this.notifyStatus(id, 'crashed', { error: err.message });
    });
  }

  async stopServer(id: string, safe: boolean = true): Promise<void> {
    const instance = this.servers.get(id);
    if (!instance || !instance.process) return;

    instance.status = 'stopping';
    instance.safeStopRequested = true;
    this.notifyStatus(id, 'stopping');

    if (safe) {
      this.sendCommand(id, 'say Server is shutting down safely...');
      this.sendCommand(id, 'save-all');
      await new Promise(resolve => setTimeout(resolve, 2000));
      this.sendCommand(id, 'stop');
    } else {
      instance.process.kill('SIGTERM');
    }

    const killTimeout = setTimeout(() => {
      if (instance.process) {
        instance.process.kill('SIGKILL');
      }
    }, 30000);

    return new Promise((resolve) => {
      const check = setInterval(() => {
        if (!instance.process) {
          clearInterval(check);
          clearTimeout(killTimeout);
          instance.status = 'stopped';
          instance.safeStopRequested = false;
          this.notifyStatus(id, 'stopped');
          resolve();
        }
      }, 100);
    });
  }

  async restartServer(id: string): Promise<void> {
    await this.stopServer(id);
    await new Promise(resolve => setTimeout(resolve, 2000));
    await this.startServer(id);
  }

  sendCommand(id: string, command: string) {
    const instance = this.servers.get(id);
    if (instance && instance.process && instance.process.stdin) {
      instance.process.stdin.write(`${command}\n`);
      this.appendTerminal(id, `> ${command}\n`);
    }
  }

  getTerminalOutput(id: string): string[] {
    return this.servers.get(id)?.terminalOutput || [];
  }

  getLogs(id: string): string[] {
    return this.servers.get(id)?.logs || [];
  }

  clearLogs(id: string) {
    const instance = this.servers.get(id);
    if (instance) {
      instance.logs = [];
    }
  }

  getServerStatus(id: string) {
    const instance = this.servers.get(id);
    if (!instance) return { status: 'stopped', running: false };
    return {
      status: instance.status,
      running: instance.process !== null,
      pid: instance.process?.pid || null,
    };
  }

  async getServerPort(id: string): Promise<number | null> {
    const instance = this.servers.get(id);
    return instance?.config.port || null;
  }

  getJVMArgs(id: string): string {
    return this.servers.get(id)?.config.jvmArgs || `-Xmx${this.servers.get(id)?.config.ram || 2}G -Xms1G`;
  }

  setJVMArgs(id: string, args: string) {
    const instance = this.servers.get(id);
    if (instance) {
      instance.config.jvmArgs = args;
      this.saveConfig(id);
    }
  }

  getServerConfig(id: string): any {
    const serverDir = path.join(SERVERS_DIR, id);
    const propsPath = path.join(serverDir, 'server.properties');
    if (fs.existsSync(propsPath)) {
      const content = fs.readFileSync(propsPath, 'utf-8');
      const lines = content.split('\n');
      const config: any = {};
      for (const line of lines) {
        const [key, ...vals] = line.split('=');
        if (key && vals.length > 0) {
          config[key.trim()] = vals.join('=').trim();
        }
      }
      return config;
    }
    return null;
  }

  setServerConfig(id: string, config: any) {
    const serverDir = path.join(SERVERS_DIR, id);
    const propsPath = path.join(serverDir, 'server.properties');
    let content = '';
    for (const [key, value] of Object.entries(config)) {
      content += `${key}=${value}\n`;
    }
    fs.writeFileSync(propsPath, content, 'utf-8');
  }

  stopAllServers() {
    for (const [id] of this.servers) {
      this.stopServer(id, true);
    }
  }

  onTerminalOutput(id: string, listener: (output: string) => void): () => void {
    const instance = this.servers.get(id);
    if (!instance) return () => {};
    instance.terminalListeners.push(listener);
    return () => {
      const idx = instance.terminalListeners.indexOf(listener);
      if (idx !== -1) instance.terminalListeners.splice(idx, 1);
    };
  }

  onStatusChange(id: string, listener: (status: string, data?: any) => void) {
    const instance = this.servers.get(id);
    if (instance) {
      instance.statusListeners.push(listener);
    }
  }

  private appendTerminal(id: string, output: string) {
    const instance = this.servers.get(id);
    if (!instance) return;
    instance.terminalOutput.push(output);
    if (instance.terminalOutput.length > 1000) {
      instance.terminalOutput.splice(0, 200);
    }
    for (const listener of instance.terminalListeners) {
      listener(output);
    }
  }

  private appendLog(id: string, entry: string) {
    const instance = this.servers.get(id);
    if (!instance) return;
    const timestamp = new Date().toISOString();
    const logEntry = `[${timestamp}] ${entry}`;
    instance.logs.push(logEntry);
    if (instance.logs.length > 5000) {
      instance.logs.splice(0, 1000);
    }

    const logDir = path.join(SERVERS_DIR, id, 'logs');
    if (!fs.existsSync(logDir)) {
      fs.mkdirSync(logDir, { recursive: true });
    }
    const logFile = path.join(logDir, `latest.log`);
    fs.appendFileSync(logFile, logEntry + '\n', 'utf-8');
  }

  private notifyStatus(id: string, status: string, data?: any) {
    const instance = this.servers.get(id);
    if (!instance) return;
    for (const listener of instance.statusListeners) {
      listener(status, data);
    }
  }

  private saveConfig(id: string) {
    const instance = this.servers.get(id);
    if (!instance) return;
    const configPath = path.join(SERVERS_DIR, id, 'server.json');
    fs.writeFileSync(configPath, JSON.stringify(instance.config, null, 2));
  }

  private findJarFile(serverDir: string): string | null {
    if (!fs.existsSync(serverDir)) return null;
    const files = fs.readdirSync(serverDir);
    const jarFiles = files.filter(f => f.endsWith('.jar') && !f.includes('-sources'));
    if (jarFiles.length === 0) return null;
    return path.join(serverDir, jarFiles[0]);
  }

  private async downloadServerJar(config: ServerConfig): Promise<void> {
    const serverDir = path.join(SERVERS_DIR, config.id);
    const jarPath = path.join(serverDir, 'server.jar');

    this.appendLog(config.id, `Downloading ${config.loader} server jar for ${config.version}...`);

    switch (config.loader) {
      case 'vanilla':
        await this.downloadVanillaJar(config, jarPath);
        break;
      case 'paper':
        const paperUrl = await this.resolvePaperUrl(config.version);
        if (!paperUrl) throw new Error(`No stable Paper build found for ${config.version}`);
        await this.downloadFile(paperUrl, jarPath);
        break;
      case 'fabric':
        await this.downloadFile(
          `https://meta.fabricmc.net/v2/versions/loader/${config.version}/latest/server/jar`,
          jarPath
        );
        break;
      case 'forge':
        await this.downloadForgeJar(config, jarPath);
        break;
      case 'neoforge':
        await this.downloadNeoForgeJar(config, jarPath);
        break;
      case 'purpur':
        await this.downloadFile(
          `https://api.purpurmc.org/v2/purpur/${config.version}/latest/download`,
          jarPath
        );
        break;
      case 'spigot':
        await this.downloadFile(
          `https://download.getbukkit.org/spigot/spigot-${config.version}.jar`,
          jarPath
        );
        break;
      default:
        throw new Error(`Unsupported loader: ${config.loader}`);
    }

    this.appendLog(config.id, `Downloaded ${config.loader} server jar successfully`);

    const downloadedJar = this.findJarFile(serverDir);
    if (downloadedJar && downloadedJar !== jarPath) {
      fs.renameSync(downloadedJar, jarPath);
    }
  }

  private async resolvePaperUrl(version: string): Promise<string | null> {
    try {
      const data = await this.fetchJSON(`https://fill.papermc.io/v3/projects/paper/versions/${version}/builds`);
      if (!Array.isArray(data)) return null;
      const stable = data.find((b: any) => b.channel === 'STABLE' && b.downloads?.['server:default']?.url);
      return stable?.downloads['server:default'].url || null;
    } catch {
      return null;
    }
  }

  private async downloadVanillaJar(config: ServerConfig, jarPath: string): Promise<void> {
    const url = await this.versionFetcher.resolveVanillaUrl(config.version);
    if (!url) throw new Error(`Could not find server download URL for Minecraft ${config.version}`);
    await this.downloadFile(url, jarPath);
  }

  private async downloadForgeJar(config: ServerConfig, jarPath: string): Promise<void> {
    const manifest = await this.fetchJSON('https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json');
    const forgeVersion = manifest.promos?.[`${config.version}-recommended`] || manifest.promos?.[`${config.version}-latest`];
    if (!forgeVersion) throw new Error(`No Forge build found for Minecraft ${config.version}`);

    const installerUrl = `https://maven.minecraftforge.net/net/minecraftforge/forge/${config.version}-${forgeVersion}/forge-${config.version}-${forgeVersion}-installer.jar`;
    const installerPath = path.join(path.dirname(jarPath), 'forge-installer.jar');

    await this.downloadFile(installerUrl, installerPath);
    this.appendLog(config.id, 'Running Forge installer...');

    return new Promise((resolve, reject) => {
      const child = spawn('java', ['-jar', installerPath, '--installServer'], {
        cwd: path.dirname(jarPath),
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      child.stdout?.on('data', (data: Buffer) => {
        this.appendTerminal(config.id, data.toString());
      });
      child.stderr?.on('data', (data: Buffer) => {
        this.appendTerminal(config.id, data.toString());
      });

      child.on('exit', (code) => {
        if (code === 0) {
          const forgeJar = fs.readdirSync(path.dirname(jarPath))
            .find(f => f.startsWith('forge-') && f.endsWith('.jar') && !f.includes('installer'));
          if (forgeJar) {
            fs.renameSync(path.join(path.dirname(jarPath), forgeJar), jarPath);
          }
          if (fs.existsSync(installerPath)) fs.unlinkSync(installerPath);
          resolve();
        } else {
          reject(new Error(`Forge installer exited with code ${code}`));
        }
      });
      child.on('error', reject);
    });
  }

  private async downloadNeoForgeJar(config: ServerConfig, jarPath: string): Promise<void> {
    const data = await this.fetchJSON('https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge');
    const matchingVersions = (data.versions || [])
      .filter((v: string) => v.startsWith(config.version) || v.startsWith(config.version.replace('.', '.')));
    if (matchingVersions.length === 0) throw new Error(`No NeoForge build found for Minecraft ${config.version}`);

    const neoVersion = matchingVersions[matchingVersions.length - 1];
    const installerUrl = `https://maven.neoforged.net/releases/net/neoforged/neoforge/${neoVersion}/neoforge-${neoVersion}-installer.jar`;
    const installerPath = path.join(path.dirname(jarPath), 'neoforge-installer.jar');

    await this.downloadFile(installerUrl, installerPath);
    this.appendLog(config.id, 'Running NeoForge installer...');

    return new Promise((resolve, reject) => {
      const child = spawn('java', ['-jar', installerPath, '--installServer'], {
        cwd: path.dirname(jarPath),
        stdio: ['pipe', 'pipe', 'pipe'],
      });

      child.stdout?.on('data', (data: Buffer) => {
        this.appendTerminal(config.id, data.toString());
      });
      child.stderr?.on('data', (data: Buffer) => {
        this.appendTerminal(config.id, data.toString());
      });

      child.on('exit', (code) => {
        if (code === 0) {
          const neoJar = fs.readdirSync(path.dirname(jarPath))
            .find(f => f.startsWith('neoforge-') && f.endsWith('.jar') && !f.includes('installer'));
          if (neoJar) {
            fs.renameSync(path.join(path.dirname(jarPath), neoJar), jarPath);
          }
          if (fs.existsSync(installerPath)) fs.unlinkSync(installerPath);
          resolve();
        } else {
          reject(new Error(`NeoForge installer exited with code ${code}`));
        }
      });
      child.on('error', reject);
    });
  }

  private downloadFile(url: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(dest);
      const protocol = url.startsWith('https') ? https : http;

      const doRequest = (downloadUrl: string, redirectCount = 0) => {
        if (redirectCount > 10) {
          reject(new Error('Too many redirects'));
          return;
        }
        let parsedUrl: URL;
        try {
          parsedUrl = new URL(downloadUrl);
        } catch {
          reject(new Error(`Invalid URL: ${downloadUrl}`));
          return;
        }
        const options = {
          hostname: parsedUrl.hostname,
          path: parsedUrl.pathname + parsedUrl.search,
          port: parsedUrl.port,
          headers: { 'User-Agent': 'Server-Creator/1.0 (AMT Entertainment)' },
          timeout: 30000,
        };

        const req = protocol.get(options, (response: any) => {
          if (response.statusCode && response.statusCode >= 300 && response.statusCode < 400 && response.headers.location) {
            file.close();
            if (fs.existsSync(dest)) fs.unlinkSync(dest);
            doRequest(response.headers.location, redirectCount + 1);
            return;
          }
          if (!response.statusCode || response.statusCode !== 200) {
            reject(new Error(`Download failed: ${response.statusCode} ${response.statusMessage || ''} for ${url}`));
            return;
          }
          const total = parseInt(response.headers['content-length'] || '0', 10);
          let downloaded = 0;
          response.on('data', (chunk: Buffer) => {
            downloaded += chunk.length;
          });
          response.pipe(file);
          file.on('finish', () => {
            file.close();
            resolve();
          });
        });
        req.on('error', (err: any) => {
          file.close();
          if (fs.existsSync(dest)) fs.unlinkSync(dest);
          reject(new Error(`Download failed: ${err.message} for ${url}`));
        });
        req.on('timeout', () => {
          req.destroy();
          file.close();
          if (fs.existsSync(dest)) fs.unlinkSync(dest);
          reject(new Error(`Download timed out: ${url}`));
        });
      };
      doRequest(url);
    });
  }

  private fetchJSON(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;
      const parsedUrl = new URL(url);
      protocol.get({
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        headers: { 'User-Agent': 'Server-Creator/1.0 (AMT Entertainment)' },
      }, (response) => {
        let data = '';
        response.on('data', (chunk) => data += chunk);
        response.on('end', () => {
          try { resolve(JSON.parse(data)); }
          catch { reject(new Error('Invalid JSON')); }
        });
      }).on('error', reject);
    });
  }

  private writeServerProperties(serverDir: string, config: ServerConfig) {
    const props = `#Minecraft server properties
#Generated by Server Creator
enable-jmx-monitoring=false
rcon.port=25575
level-seed=
gamemode=${config.gamemode}
enable-command-block=false
enable-query=false
generator-settings=
level-name=world
motd=${config.motd}
query.port=${config.port}
pvp=true
generate-structures=true
difficulty=${config.difficulty}
network-compression-threshold=256
max-tick-time=60000
max-players=${config.maxPlayers}
online-mode=true
enable-status=true
allow-flight=false
server-port=${config.port}
text-filtering-config=
spawn-protection=16
enable-rcon=false
rcon.password=
server-ip=
max-world-size=29999984
rcon.port=25575
level-type=minecraft\\:normal
enable-query=false
allow-nether=true
broadcast-console-to-ops=true
enable-jmx-monitoring=false
sync-chunk-writes=true
op-permission-level=4
prevent-proxy-connections=false
hide-online-players=false
entity-broadcast-range-percentage=100
simulation-distance=10
player-idle-timeout=0
debug=false
force-gamemode=false
rate-limit=0
hardcore=false
white-list=false
broadcast-rcon-to-ops=true
enable-dynmap=false
function-permission-level=2
spawn-radius=10
max-chained-neighbor-updates=1000000
view-distance=10
enable-jfr-monitoring=false
text-filtering-config=
`;
    fs.writeFileSync(path.join(serverDir, 'server.properties'), props);
  }

  private writeStartScript(serverDir: string, config: ServerConfig) {
    const isWin = process.platform === 'win32';
    const jvmArgs = config.jvmArgs || `-Xmx${config.ram}G -Xms${Math.min(1, config.ram)}G`;

    if (isWin) {
      const bat = `@echo off\r\njava ${jvmArgs} -jar server.jar nogui\r\npause\r\n`;
      fs.writeFileSync(path.join(serverDir, 'start.bat'), bat);
    } else {
      const sh = `#!/bin/bash\njava ${jvmArgs} -jar server.jar nogui\n`;
      const shPath = path.join(serverDir, 'start.sh');
      fs.writeFileSync(shPath, sh);
      fs.chmodSync(shPath, '755');
    }
  }
}
