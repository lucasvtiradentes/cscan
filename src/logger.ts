import * as fs from 'fs';
import * as path from 'path';
import * as os from 'os';

class Logger {
  private logFile: string;

  constructor() {
    const tmpDir = os.tmpdir();
    this.logFile = path.join(tmpDir, 'linologs.txt');
  }

  private write(level: string, message: string) {
    const timestamp = new Date().toISOString();
    const logMessage = `[${timestamp}] [${level}] ${message}\n`;

    try {
      fs.appendFileSync(this.logFile, logMessage);
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
