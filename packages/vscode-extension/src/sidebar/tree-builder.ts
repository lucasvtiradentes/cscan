import { join, relative, sep } from 'node:path';
import { FileNode, FolderNode, IssueResult, NodeKind } from '../common/types';
import { logger } from '../common/utils/logger';

function countIssues(node: FolderNode | FileNode): number {
  if (node.type === NodeKind.File) {
    return node.results.length;
  }

  let count = 0;
  for (const child of node.children.values()) {
    count += countIssues(child);
  }
  return count;
}

export function getFolderIssueCount(node: FolderNode): number {
  return countIssues(node);
}

export function buildFolderTree(results: IssueResult[], workspaceRoot: string): Map<string, FolderNode | FileNode> {
  const root = new Map<string, FolderNode | FileNode>();

  logger.debug(`Building tree with ${results.length} results, workspace: ${workspaceRoot}`);

  for (const result of results) {
    let relativePath = relative(workspaceRoot, result.uri.fsPath);

    if (relativePath.startsWith('..')) {
      logger.warn(`File outside workspace: ${result.uri.fsPath}`);
      relativePath = result.uri.fsPath;
    }

    const parts = relativePath.split(sep).filter((p) => p && p !== '.');

    if (parts.length === 0) {
      logger.error(`No parts for path: ${result.uri.fsPath}`);
      continue;
    }

    let current = root;
    let currentPath = workspaceRoot;

    for (let i = 0; i < parts.length - 1; i++) {
      const part = parts[i];
      currentPath = join(currentPath, part);

      if (!current.has(part)) {
        current.set(part, {
          type: NodeKind.Folder,
          path: currentPath,
          name: part,
          children: new Map(),
        });
      }

      const node = current.get(part);
      if (node && node.type === NodeKind.Folder) {
        current = node.children;
      }
    }

    const fileName = parts[parts.length - 1];
    const filePath = join(currentPath, fileName);

    if (!current.has(fileName)) {
      current.set(fileName, {
        type: NodeKind.File,
        path: filePath,
        name: fileName,
        results: [],
      });
    }

    const fileNode = current.get(fileName);
    if (fileNode && fileNode.type === NodeKind.File) {
      fileNode.results.push(result);
    }
  }

  return root;
}
