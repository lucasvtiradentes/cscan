import { IssueResult, ModifiedLineRange } from '../types';

function isLineInRanges(line: number, ranges: ModifiedLineRange[]): boolean {
  return ranges.some((range) => {
    const endLine = range.startLine + range.lineCount - 1;
    return line >= range.startLine && line <= endLine;
  });
}

export function getNewIssues(
  currentIssues: IssueResult[],
  modifiedRangesByFile: Map<string, ModifiedLineRange[]>,
): IssueResult[] {
  return currentIssues.filter((issue) => {
    const ranges = modifiedRangesByFile.get(issue.uri.fsPath);
    if (!ranges || ranges.length === 0) {
      return true;
    }
    return isLineInRanges(issue.line + 1, ranges);
  });
}
