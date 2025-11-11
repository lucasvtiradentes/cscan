import { spawn, ChildProcess } from 'child_process';
import * as path from 'path';
import * as vscode from 'vscode';
import { logger } from './logger';
import * as zlib from 'zlib';

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
  line_text?: string;
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

export interface RuleMetadata {
  name: string;
  displayName: string;
  description: string;
  ruleType: 'ast' | 'regex';
  defaultSeverity: 'error' | 'warning';
  defaultEnabled: boolean;
  category: 'typesafety' | 'codequality' | 'style' | 'performance';
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
      const chunkSize = data.length;
      this.buffer += data.toString();

      const lines = this.buffer.split('\n');
      this.buffer = lines.pop() || '';

      for (const line of lines) {
        if (!line.trim()) continue;
        const parseStart = Date.now();
        try {
          let jsonString = line;

          // Check if response is compressed
          if (line.startsWith('GZIP:')) {
            const decompressStart = Date.now();
            const base64Data = line.substring(5); // Remove "GZIP:" prefix
            const compressed = Buffer.from(base64Data, 'base64');
            const decompressed = zlib.gunzipSync(compressed);
            jsonString = decompressed.toString('utf8');
            const decompressTime = Date.now() - decompressStart;
            if (decompressTime > 50) {
              logger.debug(`Decompression took ${decompressTime}ms (${(compressed.length / 1024).toFixed(1)}KB → ${(decompressed.length / 1024).toFixed(1)}KB)`);
            }
          }

          const response: RpcResponse = JSON.parse(jsonString);
          const parseTime = Date.now() - parseStart;
          if (parseTime > 50) {
            logger.debug(`JSON parse took ${parseTime}ms for ${(jsonString.length / 1024 / 1024).toFixed(2)}MB response`);
          }
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
          logger.error(`Failed to parse response (chunk: ${(chunkSize / 1024).toFixed(1)}KB, line: ${(line.length / 1024).toFixed(1)}KB, buffer: ${(this.buffer.length / 1024).toFixed(1)}KB): ${e}`);
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

  async scan(workspaceRoot: string, fileFilter?: Set<string>): Promise<IssueResult[]> {
    const result: ScanResult = await this.sendRequest('scan', {
      root: workspaceRoot
    });

    logger.info(`Rust scan completed: ${result.total_issues} issues in ${result.duration_ms}ms`);

    const processStart = Date.now();

    let filesToLoad = [...new Set(result.files.map(f => f.file))];

    if (fileFilter && fileFilter.size > 0) {
      filesToLoad = filesToLoad.filter(filePath => {
        const relativePath = vscode.workspace.asRelativePath(vscode.Uri.file(filePath));
        return fileFilter.has(relativePath);
      });

      logger.debug(`Filtered ${result.files.length} → ${filesToLoad.length} files to load (fileFilter has ${fileFilter.size} entries)`);
    }

    const results: IssueResult[] = [];

    for (const fileResult of result.files) {
      const uri = vscode.Uri.file(fileResult.file);

      for (const issue of fileResult.issues) {
        let lineText = issue.line_text || '';

        if (!lineText && fileFilter && fileFilter.has(vscode.workspace.asRelativePath(uri))) {
          try {
            const document = await vscode.workspace.openTextDocument(uri);
            lineText = document.lineAt(issue.line - 1).text;
          } catch (error) {
            logger.error(`Failed to load line text for: ${fileResult.file}`);
            lineText = '';
          }
        }

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

    const processTime = Date.now() - processStart;
    logger.debug(`Post-processing ${result.total_issues} issues from ${filesToLoad.length} files took ${processTime}ms total`);

    return results;
  }

  async scanFile(workspaceRoot: string, filePath: string): Promise<IssueResult[]> {
    const result: FileResult = await this.sendRequest('scanFile', {
      root: workspaceRoot,
      file: filePath
    });

    logger.info(`Rust scan completed for single file: ${result.issues.length} issues`);

    const results: IssueResult[] = [];
    const uri = vscode.Uri.file(result.file);

    for (const issue of result.issues) {
      results.push({
        uri,
        line: issue.line - 1,
        column: issue.column - 1,
        text: (issue.line_text || '').trim(),
        type: issue.message.includes('as any') ? 'asAny' : 'colonAny',
        rule: issue.rule,
        severity: issue.severity.toLowerCase() as 'error' | 'warning'
      });
    }

    return results;
  }

  async getRulesMetadata(): Promise<RuleMetadata[]> {
    const result = await this.sendRequest('getRulesMetadata', {});
    return result;
  }
}
