import pino from 'pino';

const isDev = process.argv.includes('--dev') || process.env.NODE_ENV === 'development';

export const logger = pino({
  level: isDev ? 'debug' : 'warn',
  timestamp: pino.stdTimeFunctions.isoTime,
});

export function createModuleLogger(module: string) {
  return logger.child({ module });
}
