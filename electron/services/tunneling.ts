import { spawn, ChildProcess } from 'child_process';
import * as os from 'os';

interface TunnelInstance {
  port: number;
  url: string | null;
  status: 'stopped' | 'starting' | 'running' | 'error';
  error?: string;
  process?: ChildProcess | null;
  reconnectTimer?: NodeJS.Timeout | null;
}

export class TunnelingService {
  private tunnels: Map<string, TunnelInstance> = new Map();
  private stdoutBuffer: Map<string, string> = new Map();

  async startTunnel(serverId: string, port: number): Promise<string> {
    const existing = this.tunnels.get(serverId);
    if (existing && existing.status === 'running' && existing.url) {
      return existing.url;
    }

    const instance: TunnelInstance = { port, url: null, status: 'starting' };
    this.tunnels.set(serverId, instance);
    this.stdoutBuffer.set(serverId, '');

    this.setupReconnect(serverId, port);

    const url = await this.trySshTunnel(serverId, port);
    if (url) {
      instance.status = 'running';
      instance.url = url;
      return url;
    }

    const url2 = await this.trySshTunnelSimple(serverId, port);
    if (url2) {
      instance.status = 'running';
      instance.url = url2;
      return url2;
    }

    instance.status = 'error';
    instance.error = 'SSH tunnel failed. Make sure SSH is installed and port 443 is not blocked.';
    return '';
  }

  private killProc(proc: ChildProcess | null) {
    if (!proc || proc.killed) return;
    try { proc.kill('SIGKILL'); } catch {}
  }

  private async trySshTunnel(serverId: string, port: number): Promise<string | null> {
    return new Promise((resolve) => {
      let done = false;
      const cleanup = () => {
        const i = this.tunnels.get(serverId);
        if (i && i.process === proc) i.process = null;
        this.killProc(proc);
      };
      const timeout = setTimeout(() => {
        if (!done) { done = true; cleanup(); resolve(null); }
      }, 30000);

      const proc = spawn('ssh', [
        '-p', '443',
        '-o', 'StrictHostKeyChecking=no',
        '-o', 'UserKnownHostsFile=/dev/null',
        '-o', 'ServerAliveInterval=30',
        '-o', 'ConnectTimeout=15',
        '-o', 'ExitOnForwardFailure=yes',
        '-R', `0:localhost:${port}`,
        'tcp@a.pinggy.io',
      ], { stdio: ['ignore', 'pipe', 'pipe'] });

      const inst = this.tunnels.get(serverId);
      if (inst) inst.process = proc;

      const onData = (data: Buffer) => {
        if (done) return;
        const text = data.toString();

        const m = text.match(/(?:tcp|http|https?):\/\/([a-zA-Z0-9][a-zA-Z0-9_.-]*\.[a-zA-Z][a-zA-Z0-9_.-]*)/);
        if (m) {
          clearTimeout(timeout);
          done = true;
          cleanup();
          resolve(m[1]);
          return;
        }

        if (text.includes('denied') || text.includes('refused')) {
          clearTimeout(timeout);
          done = true;
          cleanup();
          resolve(null);
        }
      };

      proc.stdout?.on('data', onData);
      proc.stderr?.on('data', onData);
      proc.on('exit', () => {
        if (!done) { done = true; clearTimeout(timeout); cleanup(); resolve(null); }
      });
      proc.on('error', () => {
        if (!done) { done = true; clearTimeout(timeout); cleanup(); resolve(null); }
      });
    });
  }

  private async trySshTunnelSimple(serverId: string, port: number): Promise<string | null> {
    return new Promise((resolve) => {
      let done = false;
      const cleanup = () => {
        const i = this.tunnels.get(serverId);
        if (i && i.process === proc) i.process = null;
        this.killProc(proc);
      };
      const timeout = setTimeout(() => {
        if (!done) { done = true; cleanup(); resolve(null); }
      }, 25000);

      const proc = spawn('ssh', [
        '-o', 'StrictHostKeyChecking=no',
        '-o', 'UserKnownHostsFile=/dev/null',
        '-o', 'ServerAliveInterval=30',
        '-o', 'ConnectTimeout=15',
        '-R', `${port}:localhost:${port}`,
        'serveo.net',
      ], { stdio: ['ignore', 'pipe', 'pipe'] });

      const inst = this.tunnels.get(serverId);
      if (inst) inst.process = proc;

      const onData = (data: Buffer) => {
        if (done) return;
        const text = data.toString();

        const m = text.match(/([a-zA-Z0-9][a-zA-Z0-9_.-]*)\.serveo\.net/);
        if (m) {
          clearTimeout(timeout);
          done = true;
          cleanup();
          resolve(`${m[0]}:${port}`);
          return;
        }

        if (text.includes('denied') || text.includes('refused')) {
          clearTimeout(timeout);
          done = true;
          cleanup();
          resolve(null);
        }
      };

      proc.stdout?.on('data', onData);
      proc.stderr?.on('data', onData);
      proc.on('exit', () => {
        if (!done) { done = true; clearTimeout(timeout); cleanup(); resolve(null); }
      });
      proc.on('error', () => {
        if (!done) { done = true; clearTimeout(timeout); cleanup(); resolve(null); }
      });
    });
  }

  getPublicIp(): Promise<string | null> {
    return Promise.resolve(null);
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

  private setupReconnect(serverId: string, port: number) {
    const instance = this.tunnels.get(serverId);
    if (!instance) return;
    if (instance.reconnectTimer) clearInterval(instance.reconnectTimer);

    instance.reconnectTimer = setInterval(async () => {
      const inst = this.tunnels.get(serverId);
      if (!inst || inst.status === 'stopped') {
        if (inst?.reconnectTimer) { clearInterval(inst.reconnectTimer); inst.reconnectTimer = null; }
        return;
      }
      if (inst.status !== 'running' || !inst.url) {
        inst.status = 'starting';
        const url = await this.trySshTunnel(serverId, port);
        if (url) {
          inst.url = url;
          inst.status = 'running';
        } else {
          const url2 = await this.trySshTunnelSimple(serverId, port);
          if (url2) { inst.url = url2; inst.status = 'running'; }
        }
      }
    }, 60000);
  }

  stopTunnel(serverId: string) {
    const inst = this.tunnels.get(serverId);
    if (!inst) return;
    if (inst.reconnectTimer) { clearInterval(inst.reconnectTimer); inst.reconnectTimer = null; }
    if (inst.process) {
      inst.process.kill('SIGTERM');
      setTimeout(() => { if (inst.process) inst.process.kill('SIGKILL'); }, 3000);
      inst.process = null;
    }
    inst.status = 'stopped';
  }

  getTunnelStatus(serverId: string): { status: string; url: string | null; error?: string } {
    const inst = this.tunnels.get(serverId);
    if (!inst) return { status: 'stopped', url: null };
    return { status: inst.status, url: inst.url, error: inst.error };
  }

  stopAll() {
    for (const [id] of this.tunnels) this.stopTunnel(id);
  }
}
