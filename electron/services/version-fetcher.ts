import * as https from 'https';
import * as http from 'http';

interface VersionEntry {
  version: string;
  stable: boolean;
}

export class VersionFetcher {
  async getVersions(loader: string): Promise<VersionEntry[]> {
    try {
      switch (loader) {
        case 'vanilla': return await this.getVanillaVersions();
        case 'paper': return await this.getPaperVersions();
        case 'fabric': return await this.getFabricVersions();
        case 'forge': return await this.getForgeVersions();
        case 'purpur': return await this.getPurpurVersions();
        case 'spigot': return await this.getSpigotVersions();
        case 'neoforge': return await this.getNeoForgeVersions();
        default: return [];
      }
    } catch (e) {
      console.error(`Failed to fetch versions for ${loader}:`, e);
      return [];
    }
  }

  getVanillaManifest(): Promise<any> {
    return this.fetchJSON('https://piston-meta.mojang.com/mc/game/version_manifest_v2.json');
  }

  async resolveVanillaUrl(version: string): Promise<string | null> {
    const manifest = await this.getVanillaManifest();
    const entry = manifest.versions.find((v: any) => v.id === version);
    if (!entry) return null;
    const versionData = await this.fetchJSON(entry.url);
    return versionData.downloads?.server?.url || null;
  }

  neoToMc(neoVersion: string): string {
    const parts = neoVersion.split('.');
    if (parts.length >= 2) {
      const major = parseInt(parts[0], 10);
      const minor = parseInt(parts[1], 10);
      if (major >= 20) {
        return `${major - 19}.${minor}`;
      }
    }
    return neoVersion;
  }

  private async getVanillaVersions(): Promise<VersionEntry[]> {
    const manifest = await this.getVanillaManifest();
    return (manifest.versions || [])
      .filter((v: any) => v.type === 'release')
      .map((v: any) => ({ version: v.id, stable: true }))
      .sort((a: VersionEntry, b: VersionEntry) => this.compareVersions(b.version, a.version));
  }

  private async getPaperVersions(): Promise<VersionEntry[]> {
    const data = await this.fetchJSON('https://fill.papermc.io/v3/projects/paper');
    if (!data || !data.versions) return [];
    const versions: string[] = [];
    for (const group of Object.values(data.versions) as any) {
      if (Array.isArray(group)) {
        for (const v of group) {
          if (!v.includes('-')) versions.push(v);
        }
      }
    }
    return [...new Set(versions)]
      .map((v: string) => ({ version: v, stable: true }))
      .sort((a: VersionEntry, b: VersionEntry) => this.compareVersions(b.version, a.version));
  }

  private async getFabricVersions(): Promise<VersionEntry[]> {
    const gameData = await this.fetchJSON('https://meta.fabricmc.net/v2/versions/game');
    return (gameData || [])
      .filter((v: any) => v.stable)
      .map((v: any) => ({ version: v.version, stable: true }))
      .sort((a: VersionEntry, b: VersionEntry) => this.compareVersions(b.version, a.version));
  }

  private async getForgeVersions(): Promise<VersionEntry[]> {
    const data = await this.fetchJSON('https://files.minecraftforge.net/net/minecraftforge/forge/promotions_slim.json');
    const versions = new Set<string>();
    for (const key of Object.keys(data.promos || {})) {
      const mcVersion = key.split('-')[0];
      if (mcVersion && /^\d+\.\d+(\.\d+)?$/.test(mcVersion)) {
        versions.add(mcVersion);
      }
    }
    return Array.from(versions)
      .map(v => ({ version: v, stable: true }))
      .sort((a, b) => this.compareVersions(b.version, a.version));
  }

  private async getPurpurVersions(): Promise<VersionEntry[]> {
    const data = await this.fetchJSON('https://api.purpurmc.org/v2/purpur');
    return (data.versions || [])
      .map((v: string) => ({ version: v, stable: true }))
      .sort((a: VersionEntry, b: VersionEntry) => this.compareVersions(b.version, a.version));
  }

  private async getSpigotVersions(): Promise<VersionEntry[]> {
    return [
      { version: '1.21.4', stable: true },
      { version: '1.21.3', stable: true },
      { version: '1.21.1', stable: true },
      { version: '1.21', stable: true },
      { version: '1.20.6', stable: true },
      { version: '1.20.4', stable: true },
      { version: '1.20.2', stable: true },
      { version: '1.20.1', stable: true },
      { version: '1.19.4', stable: true },
      { version: '1.19.3', stable: true },
    ];
  }

  private async getNeoForgeVersions(): Promise<VersionEntry[]> {
    try {
      const data = await this.fetchJSON('https://maven.neoforged.net/api/maven/versions/releases/net/neoforged/neoforge');
      const seen = new Set<string>();
      const versions: VersionEntry[] = [];
      (data.versions || []).forEach((v: string) => {
        const parts = v.split('.');
        if (parts.length >= 2) {
          const key = `${parts[0]}.${parts[1]}`;
          if (!seen.has(key)) {
            seen.add(key);
            const mcVersion = this.neoToMc(key);
            versions.push({ version: key, stable: true });
          }
        }
      });
      return versions.sort((a, b) => this.compareVersions(b.version, a.version));
    } catch {
      return [
        { version: '21.0', stable: true },
        { version: '20.6', stable: true },
        { version: '20.4', stable: true },
        { version: '20.2', stable: true },
      ];
    }
  }

  compareVersions(a: string, b: string): number {
    const pa = a.split('.').map(Number);
    const pb = b.split('.').map(Number);
    for (let i = 0; i < Math.max(pa.length, pb.length); i++) {
      const na = pa[i] || 0;
      const nb = pb[i] || 0;
      if (na !== nb) return na - nb;
    }
    return 0;
  }

  private fetchJSON(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const parsedUrl = new URL(url);
      const protocol = parsedUrl.protocol === 'https:' ? https : http;
      const req = protocol.get({
        hostname: parsedUrl.hostname,
        path: parsedUrl.pathname + parsedUrl.search,
        headers: { 'User-Agent': 'Server-Creator/1.0 (AMT Entertainment)' },
        timeout: 10000,
      }, (response: any) => {
        let data = '';
        response.on('data', (chunk: string) => data += chunk);
        response.on('end', () => {
          if (response.statusCode && response.statusCode >= 200 && response.statusCode < 300) {
            try { resolve(JSON.parse(data)); }
            catch { reject(new Error(`Invalid JSON from ${url}`)); }
          } else {
            reject(new Error(`HTTP ${response.statusCode} from ${url}`));
          }
        });
      });
      req.on('error', reject);
      req.on('timeout', () => { req.destroy(); reject(new Error('Timeout')); });
    });
  }
}
