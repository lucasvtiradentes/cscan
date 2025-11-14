import * as vscode from 'vscode';
import { logger } from './logger';
import { ModifiedLineRange } from '../types';
import { execSync } from 'node:child_process';

type GitExtension = {
  getAPI(version: 1): GitAPI;
};

type GitAPI = {
  repositories: Repository[];
};

type Repository = {
  state: {
    HEAD: { name?: string; commit?: string } | undefined;
    refs: { name: string; commit?: string }[];
  };
  diffWithHEAD(path?: string): Promise<Change[]>;
  diffBetween(ref1: string, ref2: string): Promise<Change[]>;
};

type Change = {
  uri: vscode.Uri;
  status: number;
};

let gitApi: GitAPI | null = null;
let changedFilesCache: Map<string, Set<string>> = new Map();
let lastCacheUpdate: Map<string, number> = new Map();
const CACHE_TTL = 2000;

function getGitAPI(): GitAPI | null {
  if (!gitApi) {
    const gitExtension = vscode.extensions.getExtension<GitExtension>('vscode.git');
    if (gitExtension?.isActive) {
      gitApi = gitExtension.exports.getAPI(1);
    }
  }
  return gitApi;
}

function getRepository(workspaceRoot: string): Repository | null {
  const api = getGitAPI();
  if (!api) return null;

  const workspaceUri = vscode.Uri.file(workspaceRoot);
  return api.repositories.find(repo => {
    return workspaceUri.fsPath.startsWith(repo.state.HEAD?.commit || '');
  }) || api.repositories[0] || null;
}

export async function getCurrentBranch(workspaceRoot: string): Promise<string | null> {
  const repo = getRepository(workspaceRoot);
  if (!repo) {
    logger.error('Git repository not found');
    return null;
  }

  return repo.state.HEAD?.name || null;
}

export async function getAllBranches(workspaceRoot: string): Promise<string[]> {
  try {
   
    const output = execSync('git branch -a', {
      cwd: workspaceRoot,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore']
    });

    const branches = output
      .split('\n')
      .map((line: string) => line.trim())
      .filter((line: string) => line && !line.includes('HEAD'))
      .map((line: string) => line.replace(/^\*\s+/, ''))
      .map((line: string) => {
        if (line.startsWith('remotes/origin/')) {
          return 'origin/' + line.replace('remotes/origin/', '');
        }
        return line;
      });

    logger.debug(`Found ${branches.length} branches: ${branches.join(', ')}`);
    return branches;
  } catch (error) {
    logger.error(`Failed to get branches: ${error}`);
    return [];
  }
}

export async function getChangedFiles(workspaceRoot: string, compareBranch: string): Promise<Set<string>> {
  const cacheKey = `${workspaceRoot}:${compareBranch}`;
  const now = Date.now();
  const lastUpdate = lastCacheUpdate.get(cacheKey) || 0;

  if (now - lastUpdate < CACHE_TTL && changedFilesCache.has(cacheKey)) {
    logger.debug(`Using cached changed files (${now - lastUpdate}ms old)`);
    return changedFilesCache.get(cacheKey)!;
  }

  const repo = getRepository(workspaceRoot);
  if (!repo) {
    logger.error('Git repository not found');
    return new Set();
  }

  try {
    const startTime = Date.now();

    const changedFromHead = await repo.diffWithHEAD();

    const uncommittedFiles = new Set(
      changedFromHead.map(change => vscode.workspace.asRelativePath(change.uri))
    );

    const currentBranch = repo.state.HEAD?.name || 'HEAD';
    const committedChanges = await repo.diffBetween(compareBranch, currentBranch);

    const committedFiles = new Set(
      committedChanges.map(change => vscode.workspace.asRelativePath(change.uri))
    );

    const allFiles = new Set([...uncommittedFiles, ...committedFiles]);

    changedFilesCache.set(cacheKey, allFiles);
    lastCacheUpdate.set(cacheKey, now);

    const elapsed = Date.now() - startTime;
    logger.debug(`Git diff via VSCode API: ${uncommittedFiles.size} uncommitted + ${committedFiles.size} committed = ${allFiles.size} total (${elapsed}ms)`);

    return allFiles;
  } catch (error) {
    logger.error(`Failed to get changed files vs ${compareBranch}: ${error}`);
    return new Set();
  }
}

export function invalidateCache(workspaceRoot?: string) {
  if (workspaceRoot) {
    const keys = Array.from(changedFilesCache.keys()).filter(k => k.startsWith(workspaceRoot));
    keys.forEach(k => {
      changedFilesCache.delete(k);
      lastCacheUpdate.delete(k);
    });
    logger.debug(`Invalidated cache for workspace: ${workspaceRoot}`);
  } else {
    changedFilesCache.clear();
    lastCacheUpdate.clear();
    logger.debug('Invalidated all cache');
  }
}

export async function getFileContentAtRef(workspaceRoot: string, filePath: string, ref: string): Promise<string | null> {
  try {
   
    const content = execSync(`git show ${ref}:${filePath}`, {
      cwd: workspaceRoot,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore']
    });
    return content;
  } catch (error) {
    logger.debug(`Failed to get ${filePath} at ${ref}: ${error}`);
    return null;
  }
}

export async function getModifiedLineRanges(
  workspaceRoot: string,
  filePath: string,
  compareBranch: string
): Promise<ModifiedLineRange[]> {
  try {
   
    const currentBranch = await getCurrentBranch(workspaceRoot);
    if (!currentBranch) return [];

    const diff = execSync(`git diff ${compareBranch}...${currentBranch} -- ${filePath}`, {
      cwd: workspaceRoot,
      encoding: 'utf-8',
      stdio: ['pipe', 'pipe', 'ignore']
    });

    const addedLines = new Set<number>();
    const lines = diff.split('\n');
    let currentLine = 0;

    for (const line of lines) {
      const hunkMatch = line.match(/^@@ -\d+(?:,\d+)? \+(\d+)(?:,\d+)? @@/);
      if (hunkMatch) {
        currentLine = parseInt(hunkMatch[1], 10);
        continue;
      }

      if (line.startsWith('+') && !line.startsWith('+++')) {
        addedLines.add(currentLine);
        currentLine++;
      } else if (!line.startsWith('-')) {
        currentLine++;
      }
    }

    const sortedLines = Array.from(addedLines).sort((a, b) => a - b);
    const ranges: ModifiedLineRange[] = [];

    if (sortedLines.length > 0) {
      let rangeStart = sortedLines[0];
      let rangeCount = 1;

      for (let i = 1; i < sortedLines.length; i++) {
        if (sortedLines[i] === sortedLines[i - 1] + 1) {
          rangeCount++;
        } else {
          ranges.push({ startLine: rangeStart, lineCount: rangeCount });
          rangeStart = sortedLines[i];
          rangeCount = 1;
        }
      }
      ranges.push({ startLine: rangeStart, lineCount: rangeCount });
    }

    logger.debug(`Added line ranges for ${filePath}: ${JSON.stringify(ranges)}`);
    return ranges;
  } catch (error) {
    logger.debug(`Failed to get modified lines for ${filePath}: ${error}`);
    return [];
  }
}
