export const EXTENSION_PUBLISHER = 'lucasvtiradentes';
export const EXTENSION_NAME = 'cscanner-vscode';
export const EXTENSION_ID_PROD = `${EXTENSION_PUBLISHER}.${EXTENSION_NAME}`;
export const EXTENSION_ID_DEV = `${EXTENSION_PUBLISHER}.${EXTENSION_NAME}-dev`;
export const EXTENSION_DISPLAY_NAME = 'Cscan';

export const CONTEXT_PREFIX = 'cscanner';
export const VIEW_CONTAINER_ID = 'cscanner';
export const VIEW_ID = 'cscanExplorer';

export const DEV_SUFFIX = 'Dev';

declare const __IS_DEV_BUILD__: boolean;
const IS_DEV = typeof __IS_DEV_BUILD__ !== 'undefined' && __IS_DEV_BUILD__;

export function getCommandId(command: string): string {
  return IS_DEV ? `${CONTEXT_PREFIX}${DEV_SUFFIX}.${command}` : `${CONTEXT_PREFIX}.${command}`;
}

export function getContextKey(key: string): string {
  return IS_DEV ? `${key}${DEV_SUFFIX}` : key;
}

export function getViewId(): string {
  return IS_DEV ? `${VIEW_ID}${DEV_SUFFIX}` : VIEW_ID;
}

export const BINARY_BASE_NAME = 'cscanner-server';

export function getBinaryName(): string {
  return process.platform === 'win32' ? `${BINARY_BASE_NAME}.exe` : BINARY_BASE_NAME;
}

export const PLATFORM_TARGET_MAP: Record<string, string> = {
  'linux-x64': 'x86_64-unknown-linux-gnu',
  'linux-arm64': 'aarch64-unknown-linux-gnu',
  'darwin-x64': 'x86_64-apple-darwin',
  'darwin-arm64': 'aarch64-apple-darwin',
  'win32-x64': 'x86_64-pc-windows-msvc',
};
