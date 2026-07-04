import * as net from 'net';

export class PortChecker {
  isPortInUse(port: number): Promise<boolean> {
    return new Promise((resolve) => {
      const server = net.createServer();
      server.once('error', (err: NodeJS.ErrnoException) => {
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

  async findAvailablePort(startPort: number = 25565, maxAttempts: number = 100): Promise<number> {
    for (let port = startPort; port < startPort + maxAttempts; port++) {
      const inUse = await this.isPortInUse(port);
      if (!inUse) {
        return port;
      }
    }
    return 0;
  }
}
