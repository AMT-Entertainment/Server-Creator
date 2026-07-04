import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

const SERVERS_DIR = path.join(os.homedir(), '.server-creator', 'servers');

export class FileManager {
  private getServerDir(serverId: string): string {
    return path.join(SERVERS_DIR, serverId);
  }

  private resolvePath(serverId: string, filePath?: string): string {
    const base = this.getServerDir(serverId);
    if (!filePath || filePath === '' || filePath === '/') {
      return base;
    }
    const resolved = path.resolve(base, filePath);
    const relative = path.relative(base, resolved);
    if (relative.startsWith('..') || path.isAbsolute(relative)) {
      throw new Error('Access denied: path traversal detected');
    }
    return resolved;
  }

  listFiles(serverId: string, dirPath?: string): Array<{ name: string; path: string; isDirectory: boolean; size: number; modified: Date }> {
    const targetPath = this.resolvePath(serverId, dirPath);

    if (!fs.existsSync(targetPath)) {
      return [];
    }

    const entries = fs.readdirSync(targetPath, { withFileTypes: true });
    const results = [];

    for (const entry of entries) {
      if (entry.name.startsWith('.')) continue;
      const fullPath = path.join(targetPath, entry.name);
      try {
        const stat = fs.statSync(fullPath);
        results.push({
          name: entry.name,
          path: path.relative(this.getServerDir(serverId), fullPath),
          isDirectory: entry.isDirectory(),
          size: stat.size,
          modified: stat.mtime,
        });
      } catch {
        continue;
      }
    }

    results.sort((a, b) => {
      if (a.isDirectory && !b.isDirectory) return -1;
      if (!a.isDirectory && b.isDirectory) return 1;
      return a.name.localeCompare(b.name);
    });

    return results;
  }

  readFile(serverId: string, filePath: string): { content: string; isBinary: boolean } {
    const fullPath = this.resolvePath(serverId, filePath);

    if (!fs.existsSync(fullPath)) {
      throw new Error('File not found');
    }

    const stat = fs.statSync(fullPath);
    if (stat.size > 10 * 1024 * 1024) {
      throw new Error('File too large to open (max 10MB)');
    }

    const buffer = fs.readFileSync(fullPath);
    const isBinary = this.isBinaryBuffer(buffer);

    if (isBinary) {
      return { content: '', isBinary: true };
    }

    return { content: buffer.toString('utf-8'), isBinary: false };
  }

  writeFile(serverId: string, filePath: string, content: string) {
    const fullPath = this.resolvePath(serverId, filePath);
    const dir = path.dirname(fullPath);

    if (!fs.existsSync(dir)) {
      fs.mkdirSync(dir, { recursive: true });
    }

    fs.writeFileSync(fullPath, content, 'utf-8');
  }

  deleteFile(serverId: string, filePath: string) {
    const fullPath = this.resolvePath(serverId, filePath);

    if (!fs.existsSync(fullPath)) {
      throw new Error('File not found');
    }

    const stat = fs.statSync(fullPath);
    if (stat.isDirectory()) {
      fs.rmSync(fullPath, { recursive: true });
    } else {
      fs.unlinkSync(fullPath);
    }
  }

  private isBinaryBuffer(buffer: Buffer): boolean {
    const sampleSize = Math.min(buffer.length, 8192);
    for (let i = 0; i < sampleSize; i++) {
      const byte = buffer[i];
      if (byte === 0) return true;
      if (byte < 8 && byte !== 0 && byte !== 10 && byte !== 13) return true;
    }
    return false;
  }
}
