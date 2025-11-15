import { appendFileSync } from 'fs';
import { tmpdir } from 'os';
import { join } from 'path';

export const LOG_FILE_PATH = join(tmpdir(), 'linologs.txt');

class Logger {
  constructor() {}

  private write(level: string, message: string) {
    const now = new Date();
    const utcMinus3 = new Date(now.getTime() - 3 * 60 * 60 * 1000);
    const timestamp = utcMinus3.toISOString().replace('Z', '-03:00');
    const logMessage = `[${timestamp}] [${level}] ${message}\n`;

    try {
      appendFileSync(LOG_FILE_PATH, logMessage);
    } catch (error) {
      console.error('Failed to write log:', error);
    }
  }

  info(message: string) {
    this.write('INFO', message);
  }

  error(message: string) {
    this.write('ERROR', message);
  }

  warn(message: string) {
    this.write('WARN', message);
  }

  debug(message: string) {
    this.write('DEBUG', message);
  }
}

export const logger = new Logger();
