import * as https from 'https';
import * as http from 'http';
import * as fs from 'fs';
import * as path from 'path';

const MODRINTH_API = 'https://api.modrinth.com/v2';

interface ProjectResult {
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
  client_side: string;
  server_side: string;
  categories: string[];
  versions: string[];
}

interface VersionResult {
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

export class ModrinthAPI {
  searchProjects(
    query: string,
    loaders: string[],
    versions: string[],
    limit: number = 50
  ): Promise<ProjectResult[]> {
    return new Promise((resolve, reject) => {
      const facets: string[] = [];
      if (loaders.length > 0) {
        facets.push(`["${loaders.map(l => `categories:${l}`).join('","')}"]`);
      }
      if (versions.length > 0) {
        facets.push(`["${versions.map(v => `versions:${v}`).join('","')}"]`);
      }
      facets.push('["server_side:required","server_side:optional"]');
      facets.push('["project_type:mod","project_type:plugin"]');

      const params = new URLSearchParams({
        query,
        limit: limit.toString(),
        facets: `[${facets.join(',')}]`,
        index: 'relevance',
      });

      const url = `${MODRINTH_API}/search?${params.toString()}`;

      this.fetchJSON(url).then((data: any) => {
        resolve(data.hits || []);
      }).catch(reject);
    });
  }

  getProjectVersions(projectId: string): Promise<VersionResult[]> {
    return new Promise((resolve, reject) => {
      const url = `${MODRINTH_API}/project/${projectId}/version`;

      this.fetchJSON(url).then((data: any) => {
        resolve(data || []);
      }).catch(reject);
    });
  }

  async downloadVersion(projectId: string, versionId: string, serverPath: string): Promise<void> {
    const versions = await this.getProjectVersions(projectId);
    const version = versions.find(v => v.id === versionId);
    if (!version) throw new Error('Version not found');

    const primaryFile = version.files.find(f => f.primary) || version.files[0];
    if (!primaryFile) throw new Error('No files found for this version');

    const modsDir = path.join(serverPath, 'mods');
    if (!fs.existsSync(modsDir)) {
      fs.mkdirSync(modsDir, { recursive: true });
    }

    const dest = path.join(modsDir, primaryFile.filename);

    await this.downloadFile(primaryFile.url, dest);
  }

  private fetchJSON(url: string): Promise<any> {
    return new Promise((resolve, reject) => {
      const protocol = url.startsWith('https') ? https : http;

      protocol.get(url, {
        headers: {
          'User-Agent': 'Server-Creator/1.0 (AMT Entertainment)',
          'Accept': 'application/json',
        },
      }, (response) => {
        let data = '';
        response.on('data', (chunk) => data += chunk);
        response.on('end', () => {
          try {
            resolve(JSON.parse(data));
          } catch (e) {
            reject(new Error('Failed to parse response'));
          }
        });
      }).on('error', reject);
    });
  }

  private downloadFile(url: string, dest: string): Promise<void> {
    return new Promise((resolve, reject) => {
      const file = fs.createWriteStream(dest);
      const protocol = url.startsWith('https') ? https : http;

      protocol.get(url, {
        headers: {
          'User-Agent': 'Server-Creator/1.0 (AMT Entertainment)',
        },
      }, (response) => {
        if (response.statusCode === 301 || response.statusCode === 302) {
          file.close();
          fs.unlinkSync(dest);
          return this.downloadFile(response.headers.location!, dest).then(resolve).catch(reject);
        }
        if (response.statusCode !== 200) {
          reject(new Error(`Download failed with status ${response.statusCode}`));
          return;
        }
        const totalSize = parseInt(response.headers['content-length'] || '0', 10);
        let downloaded = 0;

        response.on('data', (chunk) => {
          downloaded += chunk.length;
        });

        response.pipe(file);
        file.on('finish', () => {
          file.close();
          resolve();
        });
      }).on('error', (err) => {
        file.close();
        if (fs.existsSync(dest)) fs.unlinkSync(dest);
        reject(err);
      });
    });
  }
}
