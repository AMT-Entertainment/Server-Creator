import { spawn, ChildProcess, execSync } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as https from 'https';
import * as http from 'http';

const natUpnp = require('nat-upnp');

interface TunnelInstance {
  port: number;
  url: string | null;
  status: 'stopped' | 'starting' | 'running' | 'error';
  error?: string;
  process?: ChildProcess | null;
  upnpClient?: any;
  reconnectTimer?: NodeJS.Timeout | null;
}

const DATA_DIR = path.join(os.homedir(), '.server-creator');
const URL_STORE_PATH = path.join(DATA_DIR, 'tunnel-urls.json');
const PLAYIT_DIR = path.join(DATA_DIR, 'playit');
const PLAYIT_BIN = path.join(PLAYIT_DIR, process.platform === 'win32' ? 'playit.exe' : 'playit');
const PLAYIT_AGENT_VERSION = '0.15.0';

export class TunnelingService {
  private tunnels: Map<string, TunnelInstance> = new Map();
  private playitProcess: ChildProcess | null = null;
  private playitUrl: string | null = null;
  private playitServerId: string | null = null;
  private playitClaimUrl: string | null = null;

  async ensurePlayitAgent(): Promise<boolean> {
    try {
      if (fs.existsSync(PLAYIT_BIN)) {
        try {
          execSync(`"${PLAYIT_BIN}" --version`, { timeout: 5000, stdio: 'ignore' });
          return true;
        } catch {
          fs.unlinkSync(PLAYIT_BIN);
        }
      }
      if (!fs.existsSync(PLAYIT_DIR)) {
        fs.mkdirSync(PLAYIT_DIR, { recursive: true });
      }

      const platform = process.platform === 'win32' ? 'windows' : process.platform === 'darwin' ? 'macos' : 'linux';
      const arch = os.arch() === 'arm64' ? 'aarch64' : 'x86_64';
      const ext = process.platform === 'win32' ? '.exe' : '';
      const url = `https://github.com/playit-cloud/playit-agent/releases/download/v${PLAYIT_AGENT_VERSION}/playit-${platform}-${arch}${ext}`;

      await this.downloadFile(url, PLAYIT_BIN);
      if (process.platform !== 'win32') {
        fs.chmodSync(PLAYIT_BIN, '755');
      }
      return true;
    } catch (e) {
      console.error('Failed to install Playit.gg agent:', e);
      return false;
    }
  }

  getPlayitClaimUrl(): string | null {
    return this.playitClaimUrl;
  }

  async startPlayitTunnel(serverId: string, port: number): Promise<string | null> {
    const instance = this.tunnels.get(serverId)!;
    const installed = await this.ensurePlayitAgent();
    if (!installed) return null;

    if (this.playitProcess) {
      try { this.playitProcess.kill('SIGTERM'); } catch {}
      this.playitProcess = null;
    }

    return new Promise((resolve) => {
      let done = false;
      const timeout = setTimeout(() => {
        if (!done) { done = true; resolve(null); }
      }, 35000);

      const configPath = path.join(PLAYIT_DIR, 'config.yml');
      const configYml = `tunnels:\n  mc-${serverId}:\n    proto: tcp\n    addr: 127.0.0.1:${port}\n`;
      fs.writeFileSync(configPath, configYml);

      const proc = spawn(PLAYIT_BIN, ['--config', configPath], {
        stdio: ['ignore', 'pipe', 'pipe'],
        env: { ...process.env, HOME: os.homedir() },
      });

      instance.process = proc;
      this.playitProcess = proc;
      this.playitServerId = serverId;
      this.playitClaimUrl = null;

      let outputBuffer = '';

      const onData = (data: Buffer) => {
        if (done) return;
        const text = data.toString();
        outputBuffer += text;

        const assignMatch = outputBuffer.match(/assigned\s+(?:tcp|udp):\/\/([^\s]+)/i)
          || outputBuffer.match(/tunnel\s+(?:tcp|udp):\/\/([^\s]+)/i)
          || outputBuffer.match(/(\d+\.\d+\.\d+\.\d+:\d+)/);
        if (assignMatch) {
          clearTimeout(timeout);
          done = true;
          instance.status = 'running';
          instance.url = assignMatch[1].replace(/^(?:tcp|udp):\/\//, '');
          this.playitUrl = instance.url;
          this.storeUrl(serverId, instance.url);
          resolve(instance.url);
          return;
        }

        const urlPattern = outputBuffer.match(/([a-zA-Z0-9][a-zA-Z0-9.-]+\.(?:playit|gg|io|com|link)[^\s]*)/i);
        if (urlPattern) {
          const addr = urlPattern[1].replace(/^https?:\/\//, '').replace(/\/.*$/, '');
          if (addr.includes(':') || addr.includes('.')) {
            clearTimeout(timeout);
            done = true;
            instance.status = 'running';
            instance.url = addr;
            this.playitUrl = addr;
            this.storeUrl(serverId, instance.url);
            resolve(instance.url);
            return;
          }
        }

        const claimUrl = text.match(/https:\/\/playit\.gg\/claim\/[^\s]+/);
        if (claimUrl) {
          this.playitClaimUrl = claimUrl[0];
          if (mainWindowCallback) {
            mainWindowCallback('playit:claim', { url: claimUrl[0] });
          }
        }
      };

      proc.stdout?.on('data', onData);
      proc.stderr?.on('data', onData);

      proc.on('exit', (code) => {
        instance.process = null;
        this.playitProcess = null;
        if (!done) {
          clearTimeout(timeout);
          done = true;
          resolve(instance.url);
        }
      });

      proc.on('error', () => {
        instance.process = null;
        this.playitProcess = null;
        if (!done) { done = true; clearTimeout(timeout); resolve(null); }
      });
    });
  }

  async getPublicIp(): Promise<string | null> {
    try {
      return await new Promise((resolve) => {
        const api = https.get('https://ifconfig.me/ip', { timeout: 5000 }, (res) => {
          let data = '';
          res.on('data', (c) => data += c);
          res.on('end', () => resolve(data.trim() || null));
        });
        api.on('error', () => resolve(null));
        api.setTimeout(5000, () => { api.destroy(); resolve(null); });
      });
    } catch { return null; }
  }

  getLocalIp(): string | null {
    try {
      const nets = os.networkInterfaces();
      for (const name of Object.keys(nets)) {
        const interfaces = nets[name];
        if (!interfaces) continue;
        for (const iface of interfaces) {
          if (iface.family === 'IPv4' && !iface.internal) return iface.address;
        }
      }
    } catch {}
    return null;
  }

  private getStoredUrl(serverId: string): string | null {
    try {
      if (fs.existsSync(URL_STORE_PATH)) {
        const data = JSON.parse(fs.readFileSync(URL_STORE_PATH, 'utf-8'));
        return data[serverId] || null;
      }
    } catch {}
    return null;
  }

  private storeUrl(serverId: string, url: string) {
    try {
      let data: Record<string, string> = {};
      if (fs.existsSync(URL_STORE_PATH)) data = JSON.parse(fs.readFileSync(URL_STORE_PATH, 'utf-8'));
      data[serverId] = url;
      fs.writeFileSync(URL_STORE_PATH, JSON.stringify(data, null, 2));
    } catch {}
  }

  async startTunnel(serverId: string, port: number): Promise<string> {
    const existing = this.tunnels.get(serverId);
    if (existing && existing.status === 'running' && existing.url) {
      return existing.url;
    }

    const stored = this.getStoredUrl(serverId);
    const instance: TunnelInstance = { port, url: stored, status: 'starting' };
    this.tunnels.set(serverId, instance);

    this.setupReconnect(serverId, port);

    const playitUrl = await this.startPlayitTunnel(serverId, port);
    if (playitUrl) return playitUrl;

    const pinggyUrl = await this.tryPinggy(serverId, port);
    if (pinggyUrl) return pinggyUrl;

    const serveoUrl = await this.tryServeo(serverId, port);
    if (serveoUrl) return serveoUrl;

    const upnpUrl = await this.tryUpnp(serverId, port);
    if (upnpUrl) return upnpUrl;

    const publicIp = await this.getPublicIp();
    if (publicIp) {
      instance.url = `${publicIp}:${port}`;
      this.storeUrl(serverId, instance.url);
      instance.status = 'running';
      return instance.url;
    }

    instance.status = 'error';
    instance.error = 'All tunneling methods failed.';
    return '';
  }

  private setupReconnect(serverId: string, port: number) {
    const instance = this.tunnels.get(serverId);
    if (!instance) return;

    if (instance.reconnectTimer) {
      clearInterval(instance.reconnectTimer);
    }

    instance.reconnectTimer = setInterval(async () => {
      const inst = this.tunnels.get(serverId);
      if (!inst || inst.status === 'stopped') {
        if (inst?.reconnectTimer) {
          clearInterval(inst.reconnectTimer);
          inst.reconnectTimer = null;
        }
        return;
      }
      if (inst.status !== 'running' || !inst.url) {
        inst.status = 'starting';
        const url = await this.startPlayitTunnel(serverId, port);
        if (!url) {
          const url2 = await this.tryPinggy(serverId, port);
          if (url2) {
            inst.url = url2;
            inst.status = 'running';
          }
        }
      }
    }, 45000);
  }

  private async tryPinggy(serverId: string, port: number): Promise<string | null> {
    const instance = this.tunnels.get(serverId)!;
    const hosts = ['a.pinggy.io', 'pinggy.io', 'tcp.pinggy.io'];

    for (const host of hosts) {
      const result = await this.tryPinggyHost(serverId, port, host, instance);
      if (result) return result;
    }
    return null;
  }

  private tryPinggyHost(serverId: string, port: number, host: string, instance: TunnelInstance): Promise<string | null> {
    return new Promise((resolve) => {
      let done = false;
      const timeout = setTimeout(() => {
        if (!done) { done = true; resolve(null); }
      }, 20000);

      const proc = spawn('ssh', [
        '-p', '443',
        '-o', 'StrictHostKeyChecking=no',
        '-o', 'UserKnownHostsFile=/dev/null',
        '-o', 'ServerAliveInterval=30',
        '-o', 'ConnectTimeout=10',
        '-R', `0:localhost:${port}`,
        `tcp@${host}`,
      ], { stdio: ['ignore', 'pipe', 'pipe'] });

      instance.process = proc;

      const onData = (data: Buffer) => {
        if (done) return;
        const text = data.toString();

        const m = text.match(/(?:tcp|http):\/\/([a-zA-Z0-9_.-]+):(\d+)/);
        if (m) {
          clearTimeout(timeout);
          done = true;
          instance.status = 'running';
          instance.url = `${m[1]}:${m[2]}`;
          this.storeUrl(serverId, instance.url);
          resolve(instance.url);
          return;
        }

        const portMatch = text.match(/Port\s+(\d+)\s+(?:is\s+)?(?:forwarded|open)/i)
          || text.match(/forwarded\s+(?:port\s+)?(\d+)/i)
          || text.match(/listening\s+(?:on\s+)?(?:port\s+)?(\d+)/i);
        if (portMatch) {
          clearTimeout(timeout);
          done = true;
          instance.status = 'running';
          instance.url = `${host}:${portMatch[1]}`;
          this.storeUrl(serverId, instance.url);
          resolve(instance.url);
          return;
        }

        if (text.includes('already in use') || text.includes('denied') || text.includes('refused') || text.includes('failed')) {
          clearTimeout(timeout);
          done = true;
          resolve(null);
        }
      };

      proc.stdout?.on('data', onData);
      proc.stderr?.on('data', onData);
      proc.on('exit', (code) => {
        instance.process = null;
        if (!done) { done = true; clearTimeout(timeout); resolve(null); }
      });
      proc.on('error', () => {
        if (!done) { done = true; clearTimeout(timeout); resolve(null); }
      });
    });
  }

  private async tryServeo(serverId: string, port: number): Promise<string | null> {
    const instance = this.tunnels.get(serverId)!;
    return new Promise((resolve) => {
      let done = false;
      const timeout = setTimeout(() => {
        if (!done) { done = true; resolve(null); }
      }, 20000);

      const proc = spawn('ssh', [
        '-o', 'StrictHostKeyChecking=no',
        '-o', 'UserKnownHostsFile=/dev/null',
        '-o', 'ServerAliveInterval=30',
        '-o', 'ConnectTimeout=10',
        '-R', `80:localhost:${port}`,
        '-R', `${port}:localhost:${port}`,
        'serveo.net',
      ], { stdio: ['ignore', 'pipe', 'pipe'] });

      instance.process = proc;

      const onData = (data: Buffer) => {
        if (done) return;
        const text = data.toString();

        const m = text.match(/(?:http|tcp):\/\/([a-zA-Z0-9_.-]+\.(?:serveo\.net))(?::(\d+))?/);
        if (m) {
          clearTimeout(timeout);
          done = true;
          instance.status = 'running';
          const addr = m[1];
          const p = m[2] || port.toString();
          instance.url = `${addr}:${p}`;
          this.storeUrl(serverId, instance.url);
          resolve(instance.url);
          return;
        }

        const fwdMatch = text.match(/Forwarding\s+(?:TCP\s+)?(?:port\s+)?(\d+)/i)
          || text.match(/(\d+):\d+\.\d+\.\d+\.\d+:\d+/);
        if (fwdMatch) {
          clearTimeout(timeout);
          done = true;
          instance.status = 'running';
          instance.url = `serveo.net:${fwdMatch[1]}`;
          this.storeUrl(serverId, instance.url);
          resolve(instance.url);
          return;
        }

        if (text.includes('denied') || text.includes('refused') || text.includes('failed')) {
          clearTimeout(timeout);
          done = true;
          resolve(null);
        }
      };

      proc.stdout?.on('data', onData);
      proc.stderr?.on('data', onData);
      proc.on('exit', (code) => {
        instance.process = null;
        if (!done) { done = true; clearTimeout(timeout); resolve(null); }
      });
      proc.on('error', () => {
        if (!done) { done = true; clearTimeout(timeout); resolve(null); }
      });
    });
  }

  private async tryUpnp(serverId: string, port: number): Promise<string | null> {
    const instance = this.tunnels.get(serverId)!;
    return new Promise((resolve) => {
      let done = false;
      const t = setTimeout(() => { if (!done) { done = true; resolve(null); } }, 10000);

      try {
        const client = natUpnp.createClient();
        instance.upnpClient = client;

        client.externalIp((err: any, ip: string) => {
          if (err || !ip) {
            clearTimeout(t); if (!done) { done = true; client.close(); resolve(null); }
            return;
          }
          client.portMapping({
            public: port,
            private: port,
            ttl: 0,
            description: `ServerCreator-${serverId}`,
          }, (mapErr: any) => {
            clearTimeout(t);
            if (done) return;
            if (mapErr) { client.close(); resolve(null); return; }
            done = true;
            instance.status = 'running';
            instance.url = `${ip}:${port}`;
            this.storeUrl(serverId, instance.url);
            resolve(instance.url);
          });
        });
      } catch {
        clearTimeout(t); if (!done) { done = true; resolve(null); }
      }
    });
  }

  stopTunnel(serverId: string) {
    const inst = this.tunnels.get(serverId);
    if (!inst) return;

    if (inst.reconnectTimer) {
      clearInterval(inst.reconnectTimer);
      inst.reconnectTimer = null;
    }

    if (inst.upnpClient) {
      try {
        inst.upnpClient.portUnmapping({ public: inst.port }, () => {});
        inst.upnpClient.close();
      } catch {}
      inst.upnpClient = null;
    }
    if (inst.process) {
      inst.process.kill('SIGTERM');
      setTimeout(() => { if (inst.process) inst.process.kill('SIGKILL'); }, 3000);
      inst.process = null;
    }
    if (this.playitServerId === serverId) {
      this.playitProcess = null;
      this.playitUrl = null;
      this.playitServerId = null;
    }
    inst.status = 'stopped';
  }

  getTunnelStatus(serverId: string): { status: string; url: string | null; error?: string } {
    const inst = this.tunnels.get(serverId);
    if (!inst) {
      const stored = this.getStoredUrl(serverId);
      return stored ? { status: 'stopped', url: stored } : { status: 'stopped', url: null };
    }
    return { status: inst.status, url: inst.url, error: inst.error };
  }

  stopAll() {
    for (const [id] of this.tunnels) this.stopTunnel(id);
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
        try { parsedUrl = new URL(downloadUrl); }
        catch { reject(new Error(`Invalid URL: ${downloadUrl}`)); return; }

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
            reject(new Error(`Download failed: ${response.statusCode}`));
            return;
          }
          response.pipe(file);
          file.on('finish', () => {
            file.close();
            resolve();
          });
        });
        req.on('error', (err: any) => {
          file.close();
          if (fs.existsSync(dest)) fs.unlinkSync(dest);
          reject(new Error(`Download failed: ${err.message}`));
        });
        req.on('timeout', () => {
          req.destroy();
          file.close();
          if (fs.existsSync(dest)) fs.unlinkSync(dest);
          reject(new Error(`Download timed out`));
        });
      };
      doRequest(url);
    });
  }
}

let mainWindowCallback: ((channel: string, data: any) => void) | null = null;

export function setMainWindowCallback(cb: ((channel: string, data: any) => void) | null) {
  mainWindowCallback = cb;
}
