import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as vscode from 'vscode';
import { logger } from './logger';

interface RpcRequest {
  id: number;
  method: string;
  params: any;
}

interface RpcResponse {
  id: number;
  result?: any;
  error?: string;
}

interface Issue {
  rule: string;
  file: string;
  line: number;
  column: number;
  message: string;
  severity: 'Error' | 'Warning';
}

interface FileResult {
  file: string;
  issues: Issue[];
}

interface ScanResult {
  files: FileResult[];
  total_issues: number;
  duration_ms: number;
}

export interface IssueResult {
  uri: vscode.Uri;
  line: number;
  column: number;
  text: string;
  type: 'colonAny' | 'asAny';
  rule: string;
  severity: 'error' | 'warning';
}

export class RustClient {
  private process: ChildProcess | null = null;
  private requestId = 0;
  private pendingRequests = new Map<number, {
    resolve: (result: any) => void;
    reject: (error: Error) => void;
  }>();
  private buffer = '';

  constructor(private binaryPath: string) {}

  async start(): Promise<void> {
    if (this.process) {
      return;
    }

    logger.info(`Starting Rust server: ${this.binaryPath}`);

    this.process = spawn(this.binaryPath, [], {
      stdio: ['pipe', 'pipe', 'pipe']
    });

    this.process.stdout!.on('data', (data: Buffer) => {
      this.buffer += data.toString();

      const lines = this.buffer.split('\n');
      this.buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        try {
          const response: RpcResponse = JSON.parse(line);
          const pending = this.pendingRequests.get(response.id);
          if (pending) {
            this.pendingRequests.delete(response.id);
            if (response.error) {
              pending.reject(new Error(response.error));
            } else {
              pending.resolve(response.result);
            }
          }
        } catch (e) {
          logger.error(`Failed to parse response (length: ${line.length}): ${e}`);
        }
      }
    });

    this.process.stderr!.on('data', (data: Buffer) => {
      logger.debug(`[Rust stderr] ${data.toString()}`);
    });

    this.process.on('error', (err) => {
      logger.error(`Rust process error: ${err}`);
    });

    this.process.on('exit', (code) => {
      logger.info(`Rust process exited with code: ${code}`);
      this.process = null;
    });
  }

  async stop(): Promise<void> {
    if (this.process) {
      this.process.kill();
      this.process = null;
    }
  }

  private async sendRequest(method: string, params: any): Promise<any> {
    if (!this.process) {
      await this.start();
    }

    const id = ++this.requestId;
    const request: RpcRequest = { id, method, params };

    return new Promise((resolve, reject) => {
      this.pendingRequests.set(id, { resolve, reject });

      const json = JSON.stringify(request);
      this.process!.stdin!.write(json + '\n');
    });
  }

  async scan(workspaceRoot: string): Promise<IssueResult[]> {
    const result: ScanResult = await this.sendRequest('scan', {
      root: workspaceRoot
    });

    logger.info(`Rust scan completed: ${result.total_issues} issues in ${result.duration_ms}ms`);

    const results: IssueResult[] = [];

    for (const fileResult of result.files) {
      for (const issue of fileResult.issues) {
        const uri = vscode.Uri.file(issue.file);
        const document = await vscode.workspace.openTextDocument(uri);
        const lineText = document.lineAt(issue.line - 1).text;

        results.push({
          uri,
          line: issue.line - 1,
          column: issue.column - 1,
          text: lineText.trim(),
          type: issue.message.includes('as any') ? 'asAny' : 'colonAny',
          rule: issue.rule,
          severity: issue.severity.toLowerCase() as 'error' | 'warning'
        });
      }
    }

    return results;
  }
}
