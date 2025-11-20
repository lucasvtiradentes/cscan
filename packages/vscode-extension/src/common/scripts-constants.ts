export const EXTENSION_PUBLISHER = 'lucasvtiradentes';
export const EXTENSION_NAME = 'cscanner-vscode';
export const EXTENSION_DISPLAY_NAME = 'Cscanner';

export const CONTEXT_PREFIX = 'cscanner';
export const VIEW_ID = 'cscannerExplorer';
export const DEV_SUFFIX = 'Dev';

export const LOG_BASENAME = 'cscannerlogs';

export function addDevSuffix(str: string): string {
  return `${str}${DEV_SUFFIX}`;
}

export function addDevLabel(str: string): string {
  return `${str} (${DEV_SUFFIX})`;
}

export function buildLogFilename(isDev: boolean): string {
  return isDev ? `${LOG_BASENAME}-${DEV_SUFFIX.toLowerCase()}.txt` : `${LOG_BASENAME}.txt`;
}
