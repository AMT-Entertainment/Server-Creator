import * as net from 'net';

export class PortChecker {
  isPortInUse(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', (err: any) => {
        if (err.code === 'EADDRINUSE') {
          resolve(true);
        } else {
          resolve(false);
        }
      });
      server.once('listening', () => {
        server.close();
        resolve(false);
      });
      server.listen(port, '0.0.0.0');
    });
  }

  findAvailablePort(startPort: number = 25565, maxAttempts: number = 100): Promise<number> {
    return new Promise(async (resolve) => {
      for (let port = startPort; port < startPort + maxAttempts; port++) {
        const inUse = await this.isPortInUse(port);
        if (!inUse) {
          resolve(port);
          return;
        }
      }
      resolve(0);
    });
  }
}
