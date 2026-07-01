import { spawn, ChildProcess } from 'child_process';
import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';
import * as https from 'https';

const natUpnp = require('nat-upnp');

interface TunnelInstance {
  port: number;
  url: string | null;
  status: 'stopped' | 'starting' | 'running' | 'error';
  error?: string;
  process?: ChildProcess | null;
  upnpClient?: any;
}

const URL_STORE_PATH = path.join(os.homedir(), '.server-creator', 'tunnel-urls.json');

export class TunnelingService {
  private tunnels: Map<string, TunnelInstance> = new Map();

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
    if (existing && existing.status === 'running' && existing.url) return existing.url;

    const instance: TunnelInstance = { port, url: this.getStoredUrl(serverId), status: 'starting' };
    this.tunnels.set(serverId, instance);

    // 1) Pinggy SSH tunnel (port 443) — no binary, works on restricted networks
    const pinggyUrl = await this.tryPinggy(serverId, port);
    if (pinggyUrl) return pinggyUrl;

    // 2) UPnP port mapping
    const upnpUrl = await this.tryUpnp(serverId, port);
    if (upnpUrl) return upnpUrl;

    // 3) Public IP fallback
    const publicIp = await this.getPublicIp();
    if (publicIp) {
      instance.url = `${publicIp}:${port}`;
      this.storeUrl(serverId, instance.url);
      return instance.url;
    }

    instance.status = 'error';
    instance.error = 'All methods failed';
    return '';
  }

  // ─── Pinggy.io SSH tunnel ──────────────────────────────────────────
  // Uses SSH over port 443. No binary, no account needed.
  private async tryPinggy(serverId: string, port: number): Promise<string | null> {
    const instance = this.tunnels.get(serverId)!;
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
        '-R', `0:localhost:${port}`,
        'tcp@a.pinggy.io',
      ], { stdio: ['ignore', 'pipe', 'pipe'] });

      instance.process = proc;

      const onData = (data: Buffer) => {
        if (done) return;
        const text = data.toString();

        const m = text.match(/tcp:\/\/([a-zA-Z0-9_.-]+):(\d+)/);
        if (m) {
          clearTimeout(timeout);
          done = true;
          instance.status = 'running';
          instance.url = `${m[1]}:${m[2]}`;
          this.storeUrl(serverId, instance.url);
          resolve(instance.url);
          return;
        }

        if (text.includes('already in use') || text.includes('denied')) {
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

  // ─── UPnP ─────────────────────────────────────────────────────────────
  private async tryUpnp(serverId: string, port: number): Promise<string | null> {
    const instance = this.tunnels.get(serverId)!;
    return new Promise((resolve) => {
      let done = false;
      const t = setTimeout(() => { if (!done) { done = true; resolve(null); } }, 8000);

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

  // ─── Stop ─────────────────────────────────────────────────────────────
  stopTunnel(serverId: string) {
    const inst = this.tunnels.get(serverId);
    if (!inst) return;

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
}
